import React, { useRef, useEffect } from 'react'
import useStore, { JOINT_NAMES, JOINT_LIMITS } from '../store/useStore'
import './ControlPanel.css'

const rad2deg = (r) => ((r * 180) / Math.PI).toFixed(1)

function JointBar({ name, value }) {
  const lim = JOINT_LIMITS[name]
  const range = lim.upper - lim.lower
  const pct = ((value - lim.lower) / range) * 100
  const limitPct = ((0 - lim.lower) / range) * 100
  const isNearLimit = value < lim.lower + 0.05 || value > lim.upper - 0.05

  return (
    <div className="joint-row">
      <span className="joint-name">{name.replace('joint_', 'A')}</span>
      <div className="joint-track">
        <div className="joint-fill" style={{ width: `${pct}%`, background: isNearLimit ? 'var(--red)' : 'var(--accent2)' }} />
        <div className="joint-zero" style={{ left: `${limitPct}%` }} />
      </div>
      <span className={`joint-val ${isNearLimit ? 'warn' : ''}`}>
        {rad2deg(value)}°
      </span>
    </div>
  )
}

function ObjectCard({ label, obj, color, onSelect, isSelected, mode, onModeChange }) {
  const fmt = (v) => v.toFixed(3)
  const p = obj.position
  const r = obj.rotation
  const g = obj.grabVector

  return (
    <div className={`obj-card ${isSelected ? 'selected' : ''}`} style={{ '--card-color': color }} onClick={onSelect}>
      <div className="obj-card-header">
        <span className="obj-dot" style={{ background: color }} />
        <span className="obj-label">{label}</span>
        {isSelected && (
          <div className="mode-btns">
            <button className={mode === 'translate' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); onModeChange('translate') }}>T</button>
            <button className={mode === 'rotate' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); onModeChange('rotate') }}>R</button>
          </div>
        )}
      </div>
      <table className="obj-table">
        <tbody>
          <tr><td className="td-label">Pos</td><td>{fmt(p[0])}</td><td>{fmt(p[1])}</td><td>{fmt(p[2])}</td></tr>
          <tr><td className="td-label">Rot°</td><td>{rad2deg(r[0])}</td><td>{rad2deg(r[1])}</td><td>{rad2deg(r[2])}</td></tr>
          <tr><td className="td-label">Grab</td><td>{fmt(g[0])}</td><td>{fmt(g[1])}</td><td>{fmt(g[2])}</td></tr>
        </tbody>
      </table>
    </div>
  )
}

function LogEntry({ entry }) {
  const colors = { info: 'var(--muted)', ok: 'var(--green)', warn: 'var(--accent)', error: 'var(--red)' }
  const ts = (entry.ts / 1000).toFixed(2)
  return (
    <div className="log-entry">
      <span className="log-ts">{ts}s</span>
      <span className="log-bullet" style={{ color: colors[entry.level] }}>●</span>
      <span className="log-msg">{entry.msg}</span>
      {entry.extra && (
        <div className="log-extra">
          {Object.entries(entry.extra).map(([k, v]) => (
            <span key={k}>{k}: <b>{typeof v === 'number' ? rad2deg(v) + '°' : v}</b></span>
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

  // Auto-scroll log to top (newest first)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0
  }, [logs.length])

  const canExecute = robotLoaded && (animState === 'idle')

  function handleExecute() {
    if (!canExecute) return
    addLog('info', 'Execute: moving arm to START position…')
    setAnimState('moving_to_start')
  }

  function handleReset() {
    resetToHome()
    addLog('info', 'Reset to home position')
  }

  return (
    <aside className="control-panel">
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">KUKA KR210 R2700-2</span>
        <span className={`status-dot ${robotLoaded ? 'online' : 'offline'}`} />
        <span className="status-label">{robotLoaded ? 'READY' : 'LOADING…'}</span>
      </div>

      {/* Objects */}
      <section className="panel-section">
        <div className="section-title">WORK OBJECTS</div>
        <ObjectCard
          label="START"
          obj={startObject}
          color="#f0a500"
          isSelected={selectedObject === 'start'}
          onSelect={() => setSelectedObject('start')}
          mode={transformMode}
          onModeChange={setTransformMode}
        />
        <ObjectCard
          label="END"
          obj={endObject}
          color="#3b82f6"
          isSelected={selectedObject === 'end'}
          onSelect={() => setSelectedObject('end')}
          mode={transformMode}
          onModeChange={setTransformMode}
        />
      </section>

      {/* Execute */}
      <section className="panel-section">
        <div className="section-title">CONTROL</div>
        <div className="ctrl-row">
          <button className={`btn-execute ${canExecute ? '' : 'disabled'}`} onClick={handleExecute}>
            {animState === 'idle' ? '▶ EXECUTE' : `⟳ ${animState.replace(/_/g, ' ').toUpperCase()}`}
          </button>
          <button className="btn-reset" onClick={handleReset} disabled={animState !== 'idle'}>⏮ HOME</button>
        </div>
        <div className="anim-bar-wrap">
          <div className="anim-bar-label">{animState.replace(/_/g, ' ')}</div>
          <div className="anim-bar-track">
            <div
              className="anim-bar-fill"
              style={{ width: `${animProgress * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* Joints */}
      <section className="panel-section">
        <div className="section-title">JOINT STATES (deg)</div>
        <div className="joints-grid">
          {JOINT_NAMES.map((n) => (
            <JointBar key={n} name={n} value={jointAngles[n] ?? 0} />
          ))}
        </div>
      </section>

      {/* Log */}
      <section className="panel-section log-section">
        <div className="section-title">
          LOG
          <button className="btn-clear" onClick={clearLogs}>CLEAR</button>
        </div>
        <div className="log-scroll" ref={logRef}>
          {logs.length === 0 && <div className="log-empty">No events yet.</div>}
          {logs.map((e) => <LogEntry key={e.id} entry={e} />)}
        </div>
      </section>
    </aside>
  )
}
