import React, { useRef, useEffect, useState } from 'react'
import useStore, { JOINT_NAMES, JOINT_LIMITS } from '../store/useStore'
import './ControlPanel.css'

// ─── Helpers ────────────────────────────────────────────────────────
const rad2deg = (r) => (r * 180) / Math.PI
const deg2rad = (d) => (d * Math.PI) / 180
const fmtDeg  = (r) => rad2deg(r).toFixed(1)

// Map a grab vector to a friendly face name and back.
const GRAB_FACES = [
  { key: '+Y', label: 'Top  (+Y)',     vec: [0,  1, 0] },
  { key: '-Y', label: 'Bottom  (-Y)',  vec: [0, -1, 0] },
  { key: '+X', label: 'Front  (+X)',   vec: [1,  0, 0] },
  { key: '-X', label: 'Back  (-X)',    vec: [-1, 0, 0] },
  { key: '+Z', label: 'Right  (+Z)',   vec: [0,  0, 1] },
  { key: '-Z', label: 'Left  (-Z)',    vec: [0,  0,-1] },
]
const vecToFaceKey = (v) => {
  const f = GRAB_FACES.find((f) =>
    Math.abs(f.vec[0] - v[0]) < 0.01 &&
    Math.abs(f.vec[1] - v[1]) < 0.01 &&
    Math.abs(f.vec[2] - v[2]) < 0.01
  )
  return f?.key ?? '+Y'
}

// ─── Number input that commits on blur or Enter ─────────────────────
function NumInput({ tag, value, step = 0.05, onCommit }) {
  const [draft, setDraft] = useState(value.toFixed(3))
  useEffect(() => { setDraft(value.toFixed(3)) }, [value])
  const commit = () => {
    const n = parseFloat(String(draft).replace(',', '.'))
    if (Number.isFinite(n)) onCommit(n)
    else setDraft(value.toFixed(3))
  }
  return (
    <div className="num">
      <span className="num-tag">{tag}</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'ArrowUp')   { e.preventDefault(); onCommit((parseFloat(draft) || 0) + step) }
          if (e.key === 'ArrowDown') { e.preventDefault(); onCommit((parseFloat(draft) || 0) - step) }
        }}
      />
    </div>
  )
}

// ─── Target editor ──────────────────────────────────────────────────
const DEFAULT_TARGETS = {
  start: { position: [0.8,  0.4, 0.5], rotation: [0, 0, 0], grabVector: [0, 1, 0] },
  end:   { position: [0.8, -0.4, 0.5], rotation: [0, 0, 0], grabVector: [0, 1, 0] },
}

function TargetEditor({ which }) {
  const {
    startObject, endObject, setStartObject, setEndObject,
    transformMode, setTransformMode,
  } = useStore()
  const obj   = which === 'start' ? startObject : endObject
  const setO  = which === 'start' ? setStartObject : setEndObject

  const setAxis = (key, idx, v) => {
    const arr = [...obj[key]]
    arr[idx] = v
    setO({ [key]: arr })
  }
  const setRotDeg = (idx, deg) => setAxis('rotation', idx, deg2rad(deg))
  const setGrab   = (faceKey) => {
    const f = GRAB_FACES.find((f) => f.key === faceKey)
    if (f) setO({ grabVector: [...f.vec] })
  }
  const reset = () => setO({ ...DEFAULT_TARGETS[which] })

  return (
    <>
      <div className="field-group">
        <div className="field-label">Position (m)</div>
        <div className="xyz">
          <NumInput tag="X" value={obj.position[0]} onCommit={(v) => setAxis('position', 0, v)} />
          <NumInput tag="Y" value={obj.position[1]} onCommit={(v) => setAxis('position', 1, v)} />
          <NumInput tag="Z" value={obj.position[2]} onCommit={(v) => setAxis('position', 2, v)} />
        </div>
      </div>

      <div className="field-group">
        <div className="field-label">Rotation (°)</div>
        <div className="xyz">
          <NumInput tag="X" step={5} value={rad2deg(obj.rotation[0])} onCommit={(v) => setRotDeg(0, v)} />
          <NumInput tag="Y" step={5} value={rad2deg(obj.rotation[1])} onCommit={(v) => setRotDeg(1, v)} />
          <NumInput tag="Z" step={5} value={rad2deg(obj.rotation[2])} onCommit={(v) => setRotDeg(2, v)} />
        </div>
      </div>

      <div className="field-group">
        <div className="field-label">Grab face</div>
        <select
          className="select"
          value={vecToFaceKey(obj.grabVector)}
          onChange={(e) => setGrab(e.target.value)}
        >
          {GRAB_FACES.map((f) => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>

      <div className="editor-actions">
        <div className="gizmo-mode">
          <button
            className={transformMode === 'translate' ? 'active' : ''}
            onClick={() => setTransformMode('translate')}
          >Move</button>
          <button
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => setTransformMode('rotate')}
          >Rotate</button>
        </div>
        <button className="btn-link" onClick={reset}>Reset</button>
      </div>
    </>
  )
}

// ─── Joints (compact, two-column) ──────────────────────────────────
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
      <span className="log-ts">{(entry.ts / 1000).toFixed(2)}s</span>
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
    selectedObject, setSelectedObject,
    addLog, clearLogs, logs,
    setAnimState, resetToHome,
  } = useStore()

  const canRun   = robotLoaded && animState === 'idle'
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
      {/* Sticky head: brand + Run + progress */}
      <div className="panel-head">
        <div className="brand">
          <div className="brand-top">
            <span className="brand-title">KUKA KR210</span>
            <span className={`status ${robotLoaded ? '' : 'off'}`}>
              <span className="status-dot" />
              {robotLoaded ? 'Ready' : 'Loading'}
            </span>
          </div>
          <span className="brand-subtitle">R2700-2 · pick & place demo</span>
        </div>

        <div className="run-row">
          <button
            className={`btn-run ${isRunning ? 'running' : ''} ${canRun || isRunning ? '' : 'disabled'}`}
            onClick={handleRun}
            disabled={!canRun}
          >
            {isRunning ? 'Running…' : 'Run pick & place'}
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

      {/* Everything below scrolls as a single column */}
      <div className="panel-scroll">
        {/* Targets */}
        <section className="section">
          <div className="section-head">Targets</div>
          <div className="tabs">
            <button
              className={selectedObject === 'start' ? 'active' : ''}
              onClick={() => setSelectedObject('start')}
            >
              <span className="tab-dot" style={{ background: 'var(--accent)' }} />
              Start
            </button>
            <button
              className={selectedObject === 'end' ? 'active' : ''}
              onClick={() => setSelectedObject('end')}
            >
              <span className="tab-dot" style={{ background: 'var(--blue)' }} />
              End
            </button>
          </div>
          <TargetEditor which={selectedObject} />
        </section>

        {/* Joints */}
        <section className="section">
          <div className="section-head">Joints</div>
          <Joints angles={jointAngles} />
        </section>

        {/* Activity log */}
        <section className="section">
          <div className="section-head">
            Activity
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
