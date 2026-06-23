import React, { useState } from 'react'
import Nav from '../../src/components/Nav'

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

export default function Panel({
  gantries, arms, grids,
  activeTool, setActiveTool,
  selectedId,
  onSelectGantry, onDeleteGantry,
  onSelectArm, onDeleteArm,
  onSelectGrid, onDeleteGrid,
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
          hint="Click a point on the floor to place a robo arm's base."
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
      </div>

      <div className="colophon">
        <span>{gantries.length} gantries · {arms.length} arms · {grids.length} grids</span>
        <span className="kbd">⌘</span>
      </div>
    </aside>
  )
}
