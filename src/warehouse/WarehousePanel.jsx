import React from 'react'
import './WarehousePanel.css'

/**
 * Side panel for the warehouse demo.
 *
 * Top: robot-count slider + Run / Stop / Reset.
 * Middle: high-level counters (pending / active / done).
 * Bottom: per-task line list — colour swatch, label, status, robot tag if
 *         assigned.  Scrolls if the task list grows past the viewport.
 */
export default function WarehousePanel({
  robots, activeCount, setActiveCount, maxRobots,
  tasks, snapshot,
  running, onRun, onStop, onReset, ready,
}) {
  const allDone   = snapshot.doneCount === tasks.length
  const inFlight  = snapshot.activeCount > 0

  return (
    <aside className="warehouse-panel">
      <div className="panel-head">
        <div className="brand">
          <div className="brand-top">
            <span className="brand-title">Warehouse demo</span>
            <span className={`status ${ready ? '' : 'off'}`}>
              <span className="status-dot" />
              {ready ? `${activeCount} robot${activeCount === 1 ? '' : 's'} ready` : 'loading'}
            </span>
          </div>
          <span className="brand-subtitle">multi-robot pick &amp; place · 20×20 m</span>
        </div>

        <div className="run-row">
          {!running ? (
            <button
              className="btn-run"
              onClick={onRun}
              disabled={!ready || allDone}
            >
              {allDone ? 'All done' : 'Run'}
            </button>
          ) : (
            <button className="btn-run running" onClick={onStop}>
              Stop
            </button>
          )}
          <button className="btn-home" onClick={onReset} disabled={inFlight}>
            Reset
          </button>
        </div>

        <div className="slider-row">
          <div className="slider-label">
            <span>Active robots</span>
            <span className="slider-value">{activeCount}</span>
          </div>
          <input
            type="range"
            min={1}
            max={maxRobots}
            step={1}
            value={activeCount}
            onChange={(e) => setActiveCount(parseInt(e.target.value, 10))}
            disabled={running}
            className="slider"
          />
          <div className="slider-ticks">
            {Array.from({ length: maxRobots }, (_, i) => (
              <span
                key={i}
                className={i + 1 === activeCount ? 'tick on' : 'tick'}
              />
            ))}
          </div>
        </div>

        <div className="counters">
          <div className="counter">
            <span className="counter-num">{snapshot.pendingCount}</span>
            <span className="counter-label">pending</span>
          </div>
          <div className="counter">
            <span className="counter-num">{snapshot.activeCount}</span>
            <span className="counter-label">active</span>
          </div>
          <div className="counter">
            <span className="counter-num">{snapshot.doneCount}</span>
            <span className="counter-label">done</span>
          </div>
        </div>
      </div>

      <div className="panel-scroll">
        <section className="section">
          <div className="section-head">Robots</div>
          <div className="robot-list">
            {robots.slice(0, activeCount).map((r) => {
              const taskId = snapshot.assignedTo[r.id]
              const task = taskId ? tasks.find((t) => t.id === taskId) : null
              return (
                <div key={r.id} className="robot-row">
                  <span className="robot-dot" style={{ background: r.color }} />
                  <span className="robot-id">{r.id.toUpperCase()}</span>
                  {task ? (
                    <span className="robot-task">
                      <span className="task-dot" style={{ background: task.color }} />
                      {task.label}
                    </span>
                  ) : (
                    <span className="robot-task idle">idle</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section className="section">
          <div className="section-head">Tasks</div>
          <div className="task-list">
            {tasks.map((t) => {
              const status = snapshot.taskStatus[t.id] || 'pending'
              const assignedRobot = Object.entries(snapshot.assignedTo)
                .find(([_, taskId]) => taskId === t.id)?.[0]
              return (
                <div key={t.id} className={`task-row ${status}`}>
                  <span className="task-swatch" style={{ background: t.color }} />
                  <span className="task-label">{t.label}</span>
                  <span className="task-coords">
                    [{t.from[0].toFixed(0)},{t.from[1].toFixed(0)}] → [{t.to[0].toFixed(0)},{t.to[1].toFixed(0)}]
                  </span>
                  <span className={`task-status ${status}`}>
                    {status === 'done'     && '✓ done'}
                    {status === 'assigned' && assignedRobot?.toUpperCase()}
                    {status === 'pending'  && '· waiting'}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </aside>
  )
}
