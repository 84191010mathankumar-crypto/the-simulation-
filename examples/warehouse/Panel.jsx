import React from 'react'

export default function Panel({ robotCount, setRobotCount, onStart, onReset, running, taskCounts, logs }) {
  return (
    <aside className="warehouse-panel">
      <div className="head">
        <h1>warehouse</h1>
        <p className="sub">multi-robot pick & place demo</p>
      </div>

      <section className="section">
        <label className="label-row">
          <span>Robots</span>
          <span className="count">{robotCount}</span>
        </label>
        <input
          type="range"
          min="1"
          max="6"
          step="1"
          value={robotCount}
          onChange={(e) => setRobotCount(Number(e.target.value))}
          disabled={running}
        />
      </section>

      <section className="section">
        <div className="btn-row">
          <button className="btn-primary" onClick={onStart} disabled={running}>
            {running ? 'Running…' : 'Start'}
          </button>
          <button className="btn-secondary" onClick={onReset}>Reset</button>
        </div>
      </section>

      <section className="section status">
        <div><span>pending</span><b>{taskCounts.pending}</b></div>
        <div><span>active</span><b>{taskCounts.assigned}</b></div>
        <div><span>done</span><b>{taskCounts.done}</b></div>
      </section>

      <section className="section log">
        <div className="section-head">Log</div>
        <div className="log-list">
          {logs.length === 0 && <div className="log-empty">No events yet.</div>}
          {logs.slice(0, 50).map((e) => (
            <div key={e.id} className={`log-row lv-${e.level}`}>
              <span className="ts">{(e.ts/1000).toFixed(1)}s</span>
              <span className="msg">{e.msg}</span>
            </div>
          ))}
        </div>
      </section>
    </aside>
  )
}
