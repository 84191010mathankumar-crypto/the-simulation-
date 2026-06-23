import React, { useState } from 'react'
import useGantryStore from '../../src/lib/gantry/useGantryStore'
import Nav from '../../src/components/Nav'
import '../../src/components/ControlPanel.css'

const rad2deg = (r) => Math.round((r * 180) / Math.PI)
const deg2rad = (d) => (d * Math.PI) / 180

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
    </div>
  )
}

function RotationField({ label, valueRad, onChange, disabled }) {
  return (
    <div className="j-row" style={{ gridTemplateColumns: '54px 1fr 40px' }}>
      <span className="j-name">{label}</span>
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={rad2deg(valueRad)}
        disabled={disabled}
        onChange={(e) => onChange(deg2rad(Number(e.target.value)))}
        style={{ width: '100%' }}
      />
      <span className="j-val">{rad2deg(valueRad)}°</span>
    </div>
  )
}

export default function GantryControlPanel() {
  const {
    pose, animState, animProgress, startObject, endObject,
    setStartObject, setEndObject,
    addLog, clearLogs, logs,
    setAnimState, resetToHome,
  } = useGantryStore()

  const canRun    = animState === 'idle'
  const isRunning = animState !== 'idle'

  const handleRun = () => {
    if (!canRun) return
    addLog('info', 'Starting pick-and-place sequence…')
    setAnimState('moving_to_start')
  }
  const handleHome = () => {
    resetToHome()
    addLog('info', 'Returned to home')
  }

  const stateLabel = animState === 'idle' ? 'idle' : animState.replace(/_/g, ' ')
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <aside className={`control-panel ${drawerOpen ? 'drawer-open' : ''}`}>
      <div className="masthead">
        <div className="mast-top">
          <span className="brand-mark">◐ Robo Playground</span>
          <div className="mast-right">
            <span className="status">
              <span className="status-dot" />
              ready
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
          Gantry <em>bot</em>
        </h1>
        <div className="mast-meta">
          <span>3-axis travel</span>
          <span className="dot-sep">·</span>
          <span>1 rotation</span>
        </div>
      </div>

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

      <div className="prog">
        <div className="prog-line">
          <span className="prog-state">{stateLabel}</span>
          <span className="prog-pct">{Math.round(animProgress * 100).toString().padStart(2, '0')}<small>%</small></span>
        </div>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${animProgress * 100}%` }} />
        </div>
      </div>

      <div className="panel-scroll">
        <section className="section">
          <div className="section-head">
            <span className="sec-num">01</span>
            <span className="sec-title">Gripper position</span>
          </div>
          <div className="joints" style={{ gridTemplateColumns: '1fr' }}>
            <div className="j-row" style={{ gridTemplateColumns: '54px 1fr 40px' }}>
              <span className="j-name">X</span><div className="j-track"><div className="j-fill" style={{ width: '100%' }} /></div>
              <span className="j-val">{pose.x.toFixed(2)}m</span>
            </div>
            <div className="j-row" style={{ gridTemplateColumns: '54px 1fr 40px' }}>
              <span className="j-name">Y</span><div className="j-track"><div className="j-fill" style={{ width: '100%' }} /></div>
              <span className="j-val">{pose.y.toFixed(2)}m</span>
            </div>
            <div className="j-row" style={{ gridTemplateColumns: '54px 1fr 40px' }}>
              <span className="j-name">Z</span><div className="j-track"><div className="j-fill" style={{ width: '100%' }} /></div>
              <span className="j-val">{pose.z.toFixed(2)}m</span>
            </div>
            <div className="j-row" style={{ gridTemplateColumns: '54px 1fr 40px' }}>
              <span className="j-name">rot Z</span><div className="j-track"><div className="j-fill" style={{ width: '100%' }} /></div>
              <span className="j-val">{rad2deg(pose.rotY)}°</span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <span className="sec-num">02</span>
            <span className="sec-title">Start &amp; end pose</span>
          </div>
          <p style={{ fontSize: '10.5px', color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>
            Drag the tan / blue boxes in the 3D view to move them. Use the
            sliders below to set how far the gripper turns the object
            (rotation around the vertical / Z axis) before it's placed.
          </p>
          <RotationField
            label="start"
            valueRad={startObject.rotY}
            disabled={isRunning}
            onChange={(v) => setStartObject({ rotY: v })}
          />
          <RotationField
            label="end"
            valueRad={endObject.rotY}
            disabled={isRunning}
            onChange={(v) => setEndObject({ rotY: v })}
          />
        </section>

        <section className="section">
          <div className="section-head">
            <span className="sec-num">03</span>
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
        <span>v0.1 · Gantry reference</span>
        <span className="kbd">⌘</span>
      </div>
    </aside>
  )
}
