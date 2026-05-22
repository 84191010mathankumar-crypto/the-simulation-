import React from 'react'

export default function Panel({ robotCount, setRobotCount, onStart, onReset, running, taskCounts, logs, loadedCount, robotsTotal }) {
  const allLoaded = loadedCount >= robotsTotal
  const total = taskCounts.pending + taskCounts.assigned + taskCounts.done

  return (
    <aside className="warehouse-panel">
      <div className="head">
        <div className="brand-line">
          <span className="brand-mark">◐ Roboclaw</span>
          <span className="edition">Vol. 02 · Warehouse</span>
        </div>
        <h1>Multi-<em>fleet</em> floor</h1>
        <div className="sub">Pick &amp; place choreography · {total} tasks</div>
      </div>

      <section className="section">
        <div className="section-head">
          <span className="sec-num">01</span>
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
          <span className="sec-num">02</span>
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
          <span className="sec-num">03</span>
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
          <span className="sec-num">04</span>
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
        <span>v0.1 · Warehouse demo</span>
        <span>{robotsTotal} arms online</span>
      </div>
    </aside>
  )
}
