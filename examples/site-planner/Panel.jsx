import React, { useEffect, useState } from 'react'
import Nav from '../../src/components/Nav'

const STATUS_HINT = {
  loading: 'Loading from public/site-config.json…',
  loaded:  'Loaded — paste new JSON into public/site-config.json to update on next reload',
  empty:   'public/site-config.json is empty — paste the JSON there to auto-load next time',
  error:   "Couldn't read public/site-config.json — paste the JSON there to auto-load next time",
}

function ToolSection({ num, title, hint, activatingLabel, active, onToggle, items, selectedId, onSelectItem, onDeleteItem, renderLabel, children, addIcon = '+', addTitle = 'Add', autoActivate = false }) {
  const [open, setOpen] = useState(false)

  useEffect(() => { if (active) setOpen(true) }, [active])

  function handleHeadClick() {
    const nextOpen = !open
    setOpen(nextOpen)
    // autoActivate: opening the section enters edit mode; closing exits it.
    if (autoActivate) {
      if (nextOpen && !active) onToggle()
      if (!nextOpen && active) onToggle()
    }
  }

  return (
    <section className={`section${open ? ' sec-open' : ''}`}>
      <div className="section-head" onClick={handleHeadClick}>
        <span className="sec-num">{num}</span>
        <span className="sec-title">{title}</span>
        {!open && items.length > 0 && <span className="sec-count">{items.length}</span>}
        <button
          className={`sec-add${active ? ' active-tool' : ''}`}
          title={active ? 'Cancel' : addTitle}
          onClick={(e) => { e.stopPropagation(); onToggle() }}
        >
          {active ? '×' : addIcon}
        </button>
        <span className="sec-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className="section-body">
          <div className="tool-hint">
            {active ? <em>{activatingLabel}</em> : hint}
          </div>
          {children}
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
        </div>
      )}
    </section>
  )
}

/* Explains, in gantry mode, how boxes were routed between the gantries and the
 * arm-fleet fallback. */
function GantryRouting({ assignment, armCount, gantryCount }) {
  const { gantryBoxes, armBoxes, gantriesWithoutStorage = [] } = assignment

  if (gantryCount === 0) {
    return (
      <div className="sim-warning">
        <strong>⚠ No gantry areas</strong>
        <span>Draw a gantry area (section 01) so it can place boxes, or switch the builder back to Robo arms.</span>
      </div>
    )
  }

  return (
    <>
      {gantryBoxes > 0 && (
        <div className="sim-ok">✓ {gantryBoxes} box{gantryBoxes === 1 ? '' : 'es'} routed to gantries</div>
      )}
      {armBoxes > 0 && (
        <div className="sim-warning">
          <strong>⚠ {armBoxes} box{armBoxes === 1 ? '' : 'es'} out of gantry reach</strong>
          {gantriesWithoutStorage.length > 0 && (
            <span>
              {gantriesWithoutStorage.length === 1 ? 'A gantry has' : `${gantriesWithoutStorage.length} gantries have`}
              {' '}targets but no storage inside their area.
            </span>
          )}
          <span>
            {armCount > 0
              ? 'These boxes will be built by the robo arms instead.'
              : "No robo arms are placed, so these boxes won't be built. Add a robo arm, or add storage inside the gantry areas."}
          </span>
        </div>
      )}
    </>
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
    <section className={`section${open ? ' sec-open' : ''}`}>
      <div className="section-head" onClick={() => setOpen((v) => !v)}>
        <span className="sec-num">08</span>
        <span className="sec-title">Config JSON</span>
        <span className="sec-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
      </div>
      {open && (
        <div className="section-body">
          <div className="json-hint">{STATUS_HINT[loadStatus] || STATUS_HINT.empty}</div>
          <div className="json-actions">
            <button className="btn-secondary" onClick={onReload}>Reload</button>
            <button className="btn-secondary" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <textarea className="json-text" readOnly value={json} spellCheck={false} />
        </div>
      )}
    </section>
  )
}

export default function Panel({
  gantries, arms, grids, zones, storageAreas,
  buildCubes, onRemoveBuildCube,
  panels, panelSize, onChangePanelSize, onSelectPanel, onDeletePanel,
  gridSizeCm, onChangeGridSize,
  boxSizeCm, onChangeBoxSize,
  activeTool, setActiveTool,
  selectedId,
  onSelectGantry, onDeleteGantry,
  onAddArm,
  onSelectArm, onDeleteArm,
  onSelectGrid, onDeleteGrid,
  onSelectZone, onDeleteZone,
  onSelectStorage, onDeleteStorage,
  showModel, onToggleModel,
  modelOpacity, onChangeModelOpacity,
  config, loadStatus, onReload,
  simulating, simDone, onStartSim, onStopSim, simStats, simProgress, armCount,
  gantryCount = 0, robotType = 'arms', setRobotType,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  function toggleTool(tool) {
    if (simulating) return
    setActiveTool((cur) => (cur === tool ? null : tool))
  }

  const isGantry = robotType === 'gantry'
  const missing = simStats?.missing ?? 0
  const needed = simStats?.needed ?? 0
  const canSimulate = needed > 0 && (isGantry ? (gantryCount > 0 || armCount > 0) : armCount > 0)
  const assignment = simStats?.assignment
  const storageWarning = missing > 0 ? (
    <div className="sim-warning">
      <strong>⚠ {missing} box{missing === 1 ? '' : 'es'} short.</strong>
      <span>
        The build needs {simStats.needed} boxes but storage only supplies {simStats.available}.
        Add more storage areas (or enlarge existing ones) to cover the missing {missing}.
      </span>
    </div>
  ) : null

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
        {/* View options */}
        <div className="view-row">
          <button
            className={`view-toggle${showModel ? ' view-on' : ''}`}
            onClick={onToggleModel}
          >
            <span className="view-icon">{showModel ? '◉' : '○'}</span>
            Site model
          </button>
          {showModel && (
            <div className="opacity-row">
              <span className="opacity-label">Opacity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={modelOpacity}
                onChange={(e) => onChangeModelOpacity(Number(e.target.value))}
                className="opacity-slider"
              />
              <span className="opacity-value">{Math.round(modelOpacity * 100)}%</span>
            </div>
          )}
        </div>

        {/* Builder — choose which robot type places the boxes */}
        <div className="builder-bar">
          <div className="builder-label">Builder</div>
          <div className="segmented" role="tablist">
            <button
              role="tab"
              aria-selected={!isGantry}
              className={`seg-btn ${!isGantry ? 'active' : ''}`}
              disabled={simulating}
              onClick={() => setRobotType && setRobotType('arms')}
            >
              Robo arms
            </button>
            <button
              role="tab"
              aria-selected={isGantry}
              className={`seg-btn ${isGantry ? 'active' : ''}`}
              disabled={simulating}
              onClick={() => setRobotType && setRobotType('gantry')}
            >
              Gantry robots
            </button>
          </div>
          <div className="robot-type-note">
            {isGantry
              ? 'Each box is placed by a gantry whose area covers both its storage and its target. Boxes no gantry can reach fall back to the robo arms.'
              : 'Mobile arms on AGVs fetch boxes from storage and build the pattern, nearest-first.'}
          </div>
          {isGantry && assignment && (
            <GantryRouting assignment={assignment} armCount={armCount} gantryCount={gantryCount} />
          )}
        </div>

        {/* Simulation — run the chosen robots to build the pattern */}
        <div className="sim-bar">
          {simulating && simDone ? (
            <>
              <button className="sim-run done" onClick={onStopSim} title="Clear the build and reset">
                ↺ Reset
              </button>
              <div className="sim-stats"><b className="sim-done-tag">✓ Done</b> · {simStats.boxes.length} placed</div>
            </>
          ) : (
            <>
              <button
                className={`sim-run${simulating ? ' running' : ''}`}
                onClick={simulating ? onStopSim : onStartSim}
                disabled={!simulating && !canSimulate}
                title={
                  !canSimulate && !simulating
                    ? (needed === 0 ? 'Add build-result boxes first'
                        : isGantry ? 'Add a gantry area (or a robo arm) first'
                        : 'Place at least one robo arm first')
                    : simulating ? 'Stop the simulation' : 'Run the build simulation'
                }
              >
                {simulating ? '■ Stop' : '▶ Build'}
              </button>
              <div className="sim-stats">
                {simulating
                  ? <><b>{simProgress.done}</b> / {simStats.boxes.length} placed</>
                  : <>{needed} box{needed === 1 ? '' : 'es'} to build</>}
              </div>
            </>
          )}
        </div>
        {missing > 0 && (
          <div className="sim-bar-warning">⚠ {missing} box{missing === 1 ? '' : 'es'} short — see Storage</div>
        )}

        <ToolSection
          num="01"
          title="Gantry robots"
          hint="Click two points on the floor to mark a gantry's operating area."
          activatingLabel="Click two floor points…"
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
          hint="Click + to add a robo arm. Arms are placed along the nearest grid edge automatically."
          activatingLabel="Adding arm…"
          active={false}
          onToggle={() => { if (!simulating && onAddArm) onAddArm() }}
          items={arms}
          selectedId={selectedId}
          onSelectItem={onSelectArm}
          onDeleteItem={onDeleteArm}
          renderLabel={(it, i) => `Arm ${i + 1}`}
        />

        <ToolSection
          num="03"
          title="Grids"
          hint="Click two points on the floor to mark a robot navigation grid area."
          activatingLabel="Click two floor points…"
          active={activeTool === 'grid'}
          onToggle={() => toggleTool('grid')}
          items={grids}
          selectedId={activeTool === 'grid' ? null : selectedId}
          onSelectItem={onSelectGrid}
          onDeleteItem={onDeleteGrid}
          renderLabel={(it, i) => `Grid ${i + 1}`}
        >
          <div className="settings-row inline">
            <span className="setting-label">Grid unit</span>
            <input
              className="setting-input"
              type="number"
              min={10}
              max={500}
              step={10}
              value={gridSizeCm}
              onChange={(e) => {
                const v = Math.max(10, Math.min(500, parseInt(e.target.value, 10) || 60))
                onChangeGridSize(v)
              }}
            />
            <span className="setting-unit">cm</span>
          </div>
        </ToolSection>

        <ToolSection
          num="04"
          title="Restricted zones"
          hint="Mark areas where arm placement is forbidden. Arms inside a zone show a red ring."
          activatingLabel="Click two floor points…"
          active={activeTool === 'zone'}
          onToggle={() => toggleTool('zone')}
          items={zones}
          selectedId={activeTool === 'zone' ? null : selectedId}
          onSelectItem={onSelectZone}
          onDeleteItem={onDeleteZone}
          renderLabel={(it, i) => `Zone ${i + 1}`}
        />

        <ToolSection
          num="05"
          title="Storage areas"
          hint="Mark areas filled with unit-sized boxes that gantry robots can fetch."
          activatingLabel="Click two floor points…"
          active={activeTool === 'storage'}
          onToggle={() => toggleTool('storage')}
          items={storageAreas}
          selectedId={activeTool === 'storage' ? null : selectedId}
          onSelectItem={onSelectStorage}
          onDeleteItem={onDeleteStorage}
          renderLabel={(it, i) => `Storage ${i + 1}`}
        >
          <div className="settings-row inline">
            <span className="setting-label">Box unit</span>
            <input
              className="setting-input"
              type="number"
              min={10}
              max={500}
              step={10}
              value={boxSizeCm}
              onChange={(e) => {
                const v = Math.max(10, Math.min(500, parseInt(e.target.value, 10) || 60))
                onChangeBoxSize(v)
              }}
            />
            <span className="setting-unit">cm</span>
          </div>
          {storageWarning}
          {missing === 0 && (simStats?.needed ?? 0) > 0 && (
            <div className="sim-ok">✓ {simStats.available} boxes available · {simStats.needed} needed</div>
          )}
        </ToolSection>

        <ToolSection
          num="06"
          title="Build result"
          hint="Click + on the 3D grid to place a box. Stack boxes by clicking + on top of an existing box."
          activatingLabel="Click + on the grid to place a box…"
          active={activeTool === 'build'}
          onToggle={() => toggleTool('build')}
          addIcon="+"
          addTitle="Add box"
          autoActivate
          items={buildCubes}
          selectedId={null}
          onSelectItem={() => {}}
          onDeleteItem={onRemoveBuildCube}
          renderLabel={(it, i) => `Box ${i + 1} · layer ${it.layer + 1}`}
        />

        <ToolSection
          num="07"
          title="Panels"
          hint="Select a size, then click a start and end point to lay panels."
          activatingLabel="Click start point, then end point…"
          active={activeTool === 'panel'}
          onToggle={() => toggleTool('panel')}
          addIcon="+"
          addTitle="Draw panel run"
          items={panels || []}
          selectedId={activeTool === 'panel' ? null : selectedId}
          onSelectItem={onSelectPanel}
          onDeleteItem={onDeletePanel}
          renderLabel={(it, i) => {
            const s = it.size || 2
            const axis = it.axis || (Math.abs((it.x2||0) - (it.x1||0)) >= Math.abs((it.z2||0) - (it.z1||0)) ? 'x' : 'z')
            const len = axis === 'x' ? Math.abs((it.x2||0) - (it.x1||0)) : Math.abs((it.z2||0) - (it.z1||0))
            const count = Math.max(1, Math.round(len / s))
            return `Panel ${i + 1} · ${s} m × ${count}`
          }}
        >
          <div className="settings-row inline">
            <span className="setting-label">Size</span>
            <div className="segmented">
              <button
                className={`seg-btn${panelSize === 2 ? ' active' : ''}`}
                onClick={() => onChangePanelSize(2)}
              >2 m</button>
              <button
                className={`seg-btn${panelSize === 4 ? ' active' : ''}`}
                onClick={() => onChangePanelSize(4)}
              >4 m</button>
            </div>
          </div>
        </ToolSection>

        <JsonSection config={config} loadStatus={loadStatus} onReload={onReload} />
      </div>

      <div className="colophon">
        <span>{gantries.length} gantries · {arms.length} arms · {grids.length} grids · {zones.length} zones · {storageAreas.length} storage · {buildCubes.length} boxes · {(panels || []).length} panels</span>
        <span className="kbd">⌘</span>
      </div>
    </aside>
  )
}
