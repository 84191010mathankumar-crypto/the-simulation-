import React, { useRef, useEffect } from 'react'
import useStore, { JOINT_NAMES, JOINT_LIMITS } from '../store/useStore'
import './ControlPanel.css'

const rad2deg = (r) => ((r * 180) / Math.PI).toFixed(1)

function JointBar({ name, value }) {
  const lim = JOINT_LIMITS[name]
  const range = lim.upper - lim.lower
  const pct = ((value - lim.lower) / range) * 100
  const zeroPct = ((0 - lim.lower) / range) * 100
  const nearLimit = value < lim.lower + 0.05 || value > lim.upper - 0.05

  return (
    <div className="joint-row">
      <span className="joint-name">{name.replace('joint_', 'A')}</span>
      <div className="joint-track">
        <div className="joint-fill" style={{ width: `${pct}%` }} />
        <div className="joint-zero" style={{ left: `${zeroPct}%` }} />
      </div>
      <span className={`joint-val ${nearLimit ? 'warn' : ''}`}>{rad2deg(value)}°</span>
    </div>
  )
}

function ObjectRow({ label, obj, color, isSelected, onSelect, mode, onModeChange }) {
  const f3 = (v) => v.toFixed(3)
  const [p, r, g] = [obj.position, obj.rotation, obj.grabVector]

  return (
    <div className={`obj-row ${isSelected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="obj-row-head">
        <span className="obj-dot" style={{ background: color }} />
        <span className="obj-label">{label}</span>
        {isSelected && (
          <div className="mode-toggle">
            <button
              className={mode === 'translate' ? 'active' : ''}
              onClick={(e) => { e.stopPropagation(); onModeChange('translate') }}
            >Move</button>
            <button
              className={mode === 'rotate' ? 'active' : ''}
              onClick={(e) => { e.stopPropagation(); onModeChange('rotate') }}
            >Rotate</button>
          </div>
        )}
      </div>
      <div className="obj-meta">
        <span className="obj-meta-label">Pos</span>
        <span>{f3(p[0])}</span><span>{f3(p[1])}</span><span>{f3(p[2])}</span>
        <span className="obj-meta-label">Rot</span>
        <span>{rad2deg(r[0])}°</span><span>{rad2deg(r[1])}°</span><span>{rad2deg(r[2])}°</span>
        <span className="obj-meta-label">Grab</span>
        <span>{f3(g[0])}</span><span>{f3(g[1])}</span><span>{f3(g[2])}</span>
      </div>
    </div>
  )
}

function LogEntry({ entry }) {
  const colors = {
    info:  'var(--ink-4)',
    ok:    'var(--green)',
    warn:  'var(--accent)',
    error: 'var(--red)',
  }
  return (
    <div className="log-entry">
      <span className="log-ts">{(entry.ts / 1000).toFixed(2)}s</span>
      <span className="log-bullet" style={{ color: colors[entry.level] }}>●</span>
      <span className="log-msg">{entry.msg}</span>
      {entry.extra && (
        <div className="log-extra">
          {Object.entries(entry.extra).map(([k, v]) => (
            <span key={k}>{k} <b>{typeof v === 'number' ? rad2deg(v) + '°' : v}</b></span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ControlPanel() {
  const {
    jointAngles, robotLoaded, animState, animProgress,
    startObject, endObject,
    selectedObject, setSelectedObject,
    transformMode, setTransformMode,
    addLog, clearLogs, logs,
    setAnimState, resetToHome,
  } = useStore()

  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [logs.length])

  const canExecute = robotLoaded && animState === 'idle'
  const isRunning  = animState !== 'idle'

  const handleExecute = () => {
    if (!canExecute) return
    addLog('info', 'Moving to start position…')
    setAnimState('moving_to_start')
  }
  const handleReset = () => {
    resetToHome()
    addLog('info', 'Returned to home')
  }

  const stateLabel = animState === 'idle' ? 'Idle' : animState.replace(/_/g, ' ')

  return (
    <aside className="control-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-header-top">
          <span className="panel-title">KUKA KR210</span>
          <span className={`status-pill ${robotLoaded ? '' : 'offline'}`}>
            <span className="status-dot" />
            {robotLoaded ? 'Ready' : 'Loading'}
          </span>
        </div>
        <span className="panel-subtitle">R2700-2 · 6-axis pick & place</span>
      </div>

      {/* Work objects */}
      <section className="panel-section">
        <div className="section-title">Targets</div>
        <div className="obj-list">
          <ObjectRow
            label="Start"
            obj={startObject}
            color="var(--accent)"
            isSelected={selectedObject === 'start'}
            onSelect={() => setSelectedObject('start')}
            mode={transformMode}
            onModeChange={setTransformMode}
          />
          <ObjectRow
            label="End"
            obj={endObject}
            color="var(--blue)"
            isSelected={selectedObject === 'end'}
            onSelect={() => setSelectedObject('end')}
            mode={transformMode}
            onModeChange={setTransformMode}
          />
        </div>
      </section>

      {/* Run */}
      <section className="panel-section">
        <div className="ctrl-row">
          <button
            className={`btn-execute ${canExecute ? '' : 'disabled'}`}
            onClick={handleExecute}
          >
            {isRunning ? 'Running…' : 'Run sequence'}
          </button>
          <button
            className="btn-reset"
            onClick={handleReset}
            disabled={animState !== 'idle'}
          >Home</button>
        </div>
        <div className="anim-status">
          <span className="anim-status-label">{stateLabel}</span>
          <span className="anim-status-pct">{(animProgress * 100).toFixed(0)}%</span>
        </div>
        <div className="anim-bar-track">
          <div className="anim-bar-fill" style={{ width: `${animProgress * 100}%` }} />
        </div>
      </section>

      {/* Joints */}
      <section className="panel-section">
        <div className="section-title">Joints</div>
        <div className="joints-grid">
          {JOINT_NAMES.map((n) => (
            <JointBar key={n} name={n} value={jointAngles[n] ?? 0} />
          ))}
        </div>
      </section>

      {/* Log */}
      <section className="panel-section log-section">
        <div className="section-title">
          Activity
          <button className="btn-clear" onClick={clearLogs}>Clear</button>
        </div>
        <div className="log-scroll" ref={logRef}>
          {logs.length === 0 && <div className="log-empty">No events yet.</div>}
          {logs.map((e) => <LogEntry key={e.id} entry={e} />)}
        </div>
      </section>
    </aside>
  )
}
