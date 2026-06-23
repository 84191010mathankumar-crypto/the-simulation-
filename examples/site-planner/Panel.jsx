import React, { useState } from 'react'
import Nav from '../../src/components/Nav'

const STATUS_HINT = {
  loading: 'Loading from public/site-config.json…',
  loaded:  'Loaded — paste new JSON into public/site-config.json to update on next reload',
  empty:   'public/site-config.json is empty — paste the JSON there to auto-load next time',
  error:   "Couldn't read public/site-config.json — paste the JSON there to auto-load next time",
}

function ToolSection({ num, title, hint, activeLabel, idleLabel, active, onToggle, items, selectedId, onSelectItem, onDeleteItem, renderLabel }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="sec-num">{num}</span>
        <span className="sec-title">{title}</span>
      </div>
      <div className="tool-hint">{hint}</div>
      <div className="btn-row">
        <button
          className={`btn-secondary ${active ? 'active-tool' : ''}`}
          onClick={onToggle}
        >
          {active ? activeLabel : idleLabel}
        </button>
      </div>
      {items.length > 0 && (
        <ul className="item-list">
          {items.map((it, i) => (
            <li
              key={it.id}
              className={it.id === selectedId ? 'active' : ''}
              onClick={() => onSelectItem(it.id)}
            >
              <span>{renderLabel(it, i)}</span>
              <button
                className="item-del"
                aria-label="Delete"
                onClick={(e) => { e.stopPropagation(); onDeleteItem(it.id) }}
              >×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function JsonSection({ config, loadStatus, onReload }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(config, null, 2)

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <section className="section json-section">
      <div className="section-head json-section-head" onClick={() => setOpen((v) => !v)}>
        <span className="sec-num">05</span>
        <span className="sec-title">Config JSON</span>
        <span className="json-toggle">{open ? '−' : '+'}</span>
      </div>
      {open && (
        <>
          <div className="json-hint">{STATUS_HINT[loadStatus] || STATUS_HINT.empty}</div>
          <div className="json-actions">
            <button className="btn-secondary" onClick={onReload}>Reload</button>
            <button className="btn-secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <textarea className="json-text" readOnly value={json} spellCheck={false} />
        </>
      )}
    </section>
  )
}

export default function Panel({
  gantries, arms, grids, zones,
  activeTool, setActiveTool,
  selectedId,
  onSelectGantry, onDeleteGantry,
  onSelectArm, onDeleteArm,
  onSelectGrid, onDeleteGrid,
  onSelectZone, onDeleteZone,
  config, loadStatus, onReload,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  function toggleTool(tool) {
    setActiveTool((cur) => (cur === tool ? null : tool))
  }

  return (
    <aside className={`planner-panel ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="head">
        <div className="brand-line">
          <span className="brand-mark">◐ Robo Playground</span>
          <div className="head-right">
            <span className="edition">Vol. 04 · Site planner</span>
            <button
              className="drawer-toggle"
              aria-label={drawerOpen ? 'Close panel' : 'Open panel'}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
        <Nav />
        <h1>Site <em>layout</em></h1>
        <div className="sub">Draw equipment areas on the site model</div>
      </div>

      <div className="panel-scroll">
        <ToolSection
          num="01"
          title="Gantry robots"
          hint="Click two points on the floor to mark a gantry's operating area."
          activeLabel="Click two floor points…"
          idleLabel="+ Draw gantry area"
          active={activeTool === 'gantry'}
          onToggle={() => toggleTool('gantry')}
          items={gantries}
          selectedId={activeTool === 'gantry' ? null : selectedId}
          onSelectItem={onSelectGantry}
          onDeleteItem={onDeleteGantry}
          renderLabel={(it, i) => `Gantry ${i + 1}`}
        />

        <ToolSection
          num="02"
          title="Robo arms"
          hint="Click a point on the floor to place a robo arm base. Ring is green when on-grid and outside restricted zones."
          activeLabel="Click floor to place…"
          idleLabel="+ Place robo arm"
          active={activeTool === 'arm'}
          onToggle={() => toggleTool('arm')}
          items={arms}
          selectedId={activeTool === 'arm' ? null : selectedId}
          onSelectItem={onSelectArm}
          onDeleteItem={onDeleteArm}
          renderLabel={(it, i) => `Arm ${i + 1}`}
        />

        <ToolSection
          num="03"
          title="Grids"
          hint="Click two points on the floor to mark a grid area."
          activeLabel="Click two floor points…"
          idleLabel="+ Draw grid"
          active={activeTool === 'grid'}
          onToggle={() => toggleTool('grid')}
          items={grids}
          selectedId={activeTool === 'grid' ? null : selectedId}
          onSelectItem={onSelectGrid}
          onDeleteItem={onDeleteGrid}
          renderLabel={(it, i) => `Grid ${i + 1}`}
        />

        <ToolSection
          num="04"
          title="Restricted zones"
          hint="Mark areas where arm placement is forbidden. Arms inside a zone show a red ring."
          activeLabel="Click two floor points…"
          idleLabel="+ Draw restricted zone"
          active={activeTool === 'zone'}
          onToggle={() => toggleTool('zone')}
          items={zones}
          selectedId={activeTool === 'zone' ? null : selectedId}
          onSelectItem={onSelectZone}
          onDeleteItem={onDeleteZone}
          renderLabel={(it, i) => `Zone ${i + 1}`}
        />

        <JsonSection config={config} loadStatus={loadStatus} onReload={onReload} />
      </div>

      <div className="colophon">
        <span>{gantries.length} gantries · {arms.length} arms · {grids.length} grids · {zones.length} zones</span>
        <span className="kbd">⌘</span>
      </div>
    </aside>
  )
}
