import React, { useState } from 'react'
import Nav from '../../src/components/Nav'
import CodeEditor from './CodeEditor'

export default function Panel({
  robotCount, setRobotCount,
  scenarios, scenarioId, onScenarioChange,
  onStart, onReset, running, taskCounts, logs, loadedCount, robotsTotal,
  customCode, onCustomCodeChange, customError,
  gridMovement, setGridMovement, showPaths, setShowPaths,
}) {
  const allLoaded = loadedCount >= robotsTotal
  const total = taskCounts.pending + taskCounts.assigned + taskCounts.done
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0]
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <aside className={`warehouse-panel ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="head">
        <div className="brand-line">
          <span className="brand-mark">◐ Robo Playground</span>
          <div className="head-right">
            <span className="edition">Vol. 02 · Warehouse</span>
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
        <h1>Multi-<em>fleet</em> floor</h1>
        <div className="sub">{scenario.description} · {total} tasks</div>
      </div>

      <section className="section">
        <div className="section-head">
          <span className="sec-num">01</span>
          <span className="sec-title">Scenario</span>
        </div>
        <div className="segmented" role="tablist">
          {scenarios.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === scenarioId}
              className={`seg-btn ${s.id === scenarioId ? 'active' : ''}`}
              disabled={running}
              onClick={() => onScenarioChange(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      </section>

      {scenarioId === 'custom' && (
        <section className="section editor-section">
          <div className="section-head">
            <span className="sec-num">01·b</span>
            <span className="sec-title">Build plan</span>
          </div>
          <CodeEditor
            value={customCode}
            onChange={onCustomCodeChange}
            error={customError}
            disabled={running}
          />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <span className="sec-num">02</span>
          <span className="sec-title">Fleet size</span>
        </div>
        <div className="robot-control">
          <span className="label">Active robots</span>
          <span className="count">
            {robotCount < 10 ? '0' : ''}<em>{robotCount}</em>
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={robotCount}
          onChange={(e) => setRobotCount(Number(e.target.value))}
          disabled={running}
        />
        <div className="tick-row">
          {[1,2,3,4,5,6].map((n) => <span key={n}>{n}</span>)}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="sec-num">03·a</span>
          <span className="sec-title">Movement</span>
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={gridMovement}
            onChange={(e) => setGridMovement(e.target.checked)}
          />
          <span>Snap AGVs to grid lines</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={showPaths}
            onChange={(e) => setShowPaths(e.target.checked)}
          />
          <span>Show travelled path</span>
        </label>
      </section>

      <section className="section dispatch">
        <div className="section-head">
          <span className="sec-num">03</span>
          <span className="sec-title">Dispatch</span>
        </div>
        <div className="btn-row">
          <button
            className={`btn-primary ${running ? 'running' : ''}`}
            onClick={onStart}
            disabled={running || !allLoaded}
          >
            <span>
              {running ? 'Running' : allLoaded ? 'Start dispatch' : `Loading ${loadedCount}/${robotsTotal}`}
            </span>
            <span className="arrow">→</span>
          </button>
          <button className="btn-secondary" onClick={onReset}>Reset</button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="sec-num">04</span>
          <span className="sec-title">Task ledger</span>
        </div>
        <div className="status-grid">
          <div>
            <span className="label">Pending</span>
            <span className="num">{String(taskCounts.pending).padStart(2,'0')}</span>
          </div>
          <div>
            <span className="label">Active</span>
            <span className="num active">{String(taskCounts.assigned).padStart(2,'0')}</span>
          </div>
          <div>
            <span className="label">Done</span>
            <span className="num done">{String(taskCounts.done).padStart(2,'0')}</span>
          </div>
        </div>
      </section>

      <section className="section log">
        <div className="section-head">
          <span className="sec-num">05</span>
          <span className="sec-title">Event log</span>
        </div>
        <div className="log-list">
          {logs.length === 0 && <div className="log-empty">waiting for events…</div>}
          {logs.slice(0, 50).map((e) => (
            <div key={e.id} className={`log-row lv-${e.level}`}>
              <span className="ts">{(e.ts/1000).toFixed(1)}s</span>
              <span className="dot">●</span>
              <span className="msg">{e.msg}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="colophon">
        <span>{scenario.name} · {scenario.boxes.length} pieces</span>
        <span>{robotsTotal} arms</span>
      </div>
    </aside>
  )
}
