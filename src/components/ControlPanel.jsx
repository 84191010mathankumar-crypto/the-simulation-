import React, { useState } from 'react'
import { useStore, JOINT_NAMES, JOINT_LIMITS } from '../lib'
import Nav from './Nav'
import './ControlPanel.css'

const rad2deg = (r) => (r * 180) / Math.PI
const fmtDeg  = (r) => rad2deg(r).toFixed(0)

function Joints({ angles }) {
  return (
    <div className="joints">
      {JOINT_NAMES.map((n, i) => {
        const v   = angles[n] ?? 0
        const lim = JOINT_LIMITS[n]
        const pct  = ((v - lim.lower) / (lim.upper - lim.lower)) * 100
        const zPct = ((0 - lim.lower) / (lim.upper - lim.lower)) * 100
        const near = v < lim.lower + 0.05 || v > lim.upper - 0.05
        return (
          <div className="j-row" key={n}>
            <span className="j-name">A{i + 1}</span>
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

export default function ControlPanel() {
  const {
    jointAngles, robotLoaded, animState, animProgress,
    followTarget, setFollowTarget,
    mobileMode, setMobileMode,
    addLog, clearLogs, logs,
    setAnimState, resetToHome,
  } = useStore()

  const canRun    = robotLoaded && animState === 'idle'
  const isRunning = animState !== 'idle'

  const handleRun = () => {
    if (!canRun) return
    setFollowTarget(null)
    addLog('info', 'Moving to start position…')
    setAnimState('moving_to_start')
  }
  const handleHome = () => {
    setFollowTarget(null)
    resetToHome()
    addLog('info', 'Returned to home')
  }
  const toggleFollow = (which) => {
    if (isRunning) return
    if (followTarget === which) {
      setFollowTarget(null)
      addLog('info', `Stopped following ${which}`)
    } else {
      setFollowTarget(which)
      addLog('info', `Following ${which} — drag the gumball to move the arm`)
    }
  }

  const stateLabel = animState === 'idle' ? 'idle' : animState.replace(/_/g, ' ')
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <aside className={`control-panel ${drawerOpen ? 'drawer-open' : ''}`}>
      {/* ── Masthead ────────────────────────────────────────── */}
      <div className="masthead">
        <div className="mast-top">
          <span className="brand-mark">◐ Robo Playground</span>
          <div className="mast-right">
            <span className={`status ${robotLoaded ? '' : 'off'}`}>
              <span className="status-dot" />
              {robotLoaded ? 'online' : 'booting'}
            </span>
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
        <h1 className="display-title">
          KR <em>210</em>
        </h1>
        <div className="mast-meta">
          <span>R2700-2</span>
          <span className="dot-sep">·</span>
          <span>6 axes</span>
          <span className="dot-sep">·</span>
          <span>2700 mm reach</span>
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────── */}
      <div className="action-bar">
        <button
          className={`btn-run ${isRunning ? 'running' : ''}`}
          onClick={handleRun}
          disabled={!canRun}
        >
          <span className="btn-run-label">{isRunning ? 'Running' : 'Run sequence'}</span>
          <span className="btn-run-arrow">→</span>
        </button>
        <button className="btn-home" onClick={handleHome} disabled={isRunning} title="Return home">
          ⤺
        </button>
      </div>

      <div className="follow-bar">
        <button
          className={`btn-follow ${followTarget === 'start' ? 'active' : ''}`}
          onClick={() => toggleFollow('start')}
          disabled={isRunning}
        >
          <span className="follow-dot" style={{ background: 'var(--accent)' }} />
          <span>start</span>
        </button>
        <button
          className={`btn-follow ${followTarget === 'end' ? 'active' : ''}`}
          onClick={() => toggleFollow('end')}
          disabled={isRunning}
        >
          <span className="follow-dot" style={{ background: 'var(--blue)' }} />
          <span>end</span>
        </button>
      </div>

      <label className="toggle-row" aria-disabled={isRunning}>
        <input
          type="checkbox"
          checked={mobileMode}
          disabled={isRunning}
          onChange={(e) => {
            setMobileMode(e.target.checked)
            addLog('info', e.target.checked ? 'Mobile platform enabled' : 'Mobile platform disabled')
          }}
        />
        <span className="toggle-switch" />
        <span className="toggle-label">Mobile platform</span>
        <span className="toggle-hint">AGV mode</span>
      </label>

      {/* ── Progress strip ─────────────────────────────────── */}
      <div className="prog">
        <div className="prog-line">
          <span className="prog-state">{stateLabel}</span>
          <span className="prog-pct">{Math.round(animProgress * 100).toString().padStart(2, '0')}<small>%</small></span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${animProgress * 100}%` }} />
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────── */}
      <div className="panel-scroll">
        <section className="section">
          <div className="section-head">
            <span className="sec-num">01</span>
            <span className="sec-title">Joints</span>
          </div>
          <Joints angles={jointAngles} />
        </section>

        <section className="section">
          <div className="section-head">
            <span className="sec-num">02</span>
            <span className="sec-title">Event Log</span>
            <button className="btn-clear" onClick={clearLogs}>clear</button>
          </div>
          <div className="log-list">
            {logs.length === 0 && <div className="log-empty">waiting for events…</div>}
            {logs.map((e) => <LogEntry key={e.id} entry={e} />)}
          </div>
        </section>
      </div>

      <div className="colophon">
        <span>v0.1 · KR210 reference</span>
        <span className="kbd">⌘</span>
      </div>
    </aside>
  )
}
