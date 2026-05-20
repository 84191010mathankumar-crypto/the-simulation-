import React from 'react'
import useStore, { JOINT_NAMES, JOINT_LIMITS } from '../store/useStore'
import './ControlPanel.css'

const rad2deg = (r) => (r * 180) / Math.PI
const fmtDeg  = (r) => rad2deg(r).toFixed(0)

// ─── Joints (compact two-col, 6 axes) ───────────────────────────────
function Joints({ angles }) {
  return (
    <div className="joints">
      {JOINT_NAMES.map((n) => {
        const v   = angles[n] ?? 0
        const lim = JOINT_LIMITS[n]
        const pct  = ((v - lim.lower) / (lim.upper - lim.lower)) * 100
        const zPct = ((0 - lim.lower) / (lim.upper - lim.lower)) * 100
        const near = v < lim.lower + 0.05 || v > lim.upper - 0.05
        return (
          <div className="j-row" key={n}>
            <span className="j-name">{n.replace('joint_', 'A')}</span>
            <div className="j-track">
              <div className="j-fill" style={{ width: `${pct}%` }} />
              <div className="j-zero" style={{ left: `${zPct}%` }} />
            </div>
            <span className={`j-val ${near ? 'warn' : ''}`}>{fmtDeg(v)}°</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Log entry ──────────────────────────────────────────────────────
const LEVEL_COLOR = {
  info:  'var(--ink-4)',
  ok:    'var(--green)',
  warn:  'var(--accent)',
  error: 'var(--red)',
}
function LogEntry({ entry }) {
  return (
    <div className="log-entry">
      <span className="log-ts">{(entry.ts / 1000).toFixed(1)}s</span>
      <span className="log-bullet" style={{ color: LEVEL_COLOR[entry.level] }}>●</span>
      <span className="log-msg">{entry.msg}</span>
      {entry.extra && (
        <div className="log-extra">
          {Object.entries(entry.extra).map(([k, v]) => (
            <span key={k}>{k} <b>{typeof v === 'number' ? fmtDeg(v) + '°' : v}</b></span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ─────────────────────────────────────────────────────
export default function ControlPanel() {
  const {
    jointAngles, robotLoaded, animState, animProgress,
    addLog, clearLogs, logs,
    setAnimState, resetToHome,
  } = useStore()

  const canRun    = robotLoaded && animState === 'idle'
  const isRunning = animState !== 'idle'

  const handleRun = () => {
    if (!canRun) return
    addLog('info', 'Moving to start position…')
    setAnimState('moving_to_start')
  }
  const handleHome = () => {
    resetToHome()
    addLog('info', 'Returned to home')
  }

  const stateLabel = animState === 'idle' ? 'Idle' : animState.replace(/_/g, ' ')

  return (
    <aside className="control-panel">
      {/* Sticky head */}
      <div className="panel-head">
        <div className="brand">
          <div className="brand-top">
            <span className="brand-title">KUKA KR210</span>
            <span className={`status ${robotLoaded ? '' : 'off'}`}>
              <span className="status-dot" />
              {robotLoaded ? 'ready' : 'loading'}
            </span>
          </div>
          <span className="brand-subtitle">R2700-2 · dev panel</span>
        </div>

        <div className="run-row">
          <button
            className={`btn-run ${isRunning ? 'running' : ''} ${canRun || isRunning ? '' : 'disabled'}`}
            onClick={handleRun}
            disabled={!canRun}
          >
            {isRunning ? 'Running…' : 'Run'}
          </button>
          <button className="btn-home" onClick={handleHome} disabled={isRunning}>
            Home
          </button>
        </div>

        <div className="prog">
          <span className="prog-state">{stateLabel}</span>
          <div className="prog-track">
            <div className="prog-fill" style={{ width: `${animProgress * 100}%` }} />
          </div>
          <span className="prog-pct">{Math.round(animProgress * 100)}%</span>
        </div>
      </div>

      <div className="panel-scroll">
        {/* Joints */}
        <section className="section">
          <div className="section-head">Joints</div>
          <Joints angles={jointAngles} />
        </section>

        {/* Log */}
        <section className="section">
          <div className="section-head">
            Log
            <button className="btn-clear" onClick={clearLogs}>Clear</button>
          </div>
          <div className="log-list">
            {logs.length === 0 && <div className="log-empty">No events yet.</div>}
            {logs.map((e) => <LogEntry key={e.id} entry={e} />)}
          </div>
        </section>
      </div>
    </aside>
  )
}
