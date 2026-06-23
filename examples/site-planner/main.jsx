import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import JsonBar from './JsonBar'
import SitePlannerScene from './SitePlannerScene'
import '../warehouse/Panel.css'
import './site-planner.css'

const round = (n) => Math.round(n * 100) / 100
const CONFIG_URL = `${import.meta.env.BASE_URL}site-config.json`

// Keeps the per-type id counters ahead of whatever numbers are already used
// in a loaded config, so newly-placed items never collide with loaded ones.
function bumpCounter(nextId, type, id) {
  const n = Number(String(id).split('-').pop())
  if (Number.isFinite(n) && n >= nextId.current[type]) nextId.current[type] = n + 1
}

function App() {
  const [gantries, setGantries] = useState([])
  const [arms, setArms] = useState([])
  const [grids, setGrids] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loadStatus, setLoadStatus] = useState('loading') // 'loading' | 'loaded' | 'empty' | 'error'

  const nextId = useRef({ gantry: 1, arm: 1, grid: 1 })
  const makeId = (type) => `${type}-${nextId.current[type]++}`

  // ── Load site-config.json on page open ──────────────────────────────
  const loadConfig = useCallback(() => {
    setLoadStatus('loading')
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) { setLoadStatus('empty'); return }
        const loadedGantries = data.gantryRobots || []
        const loadedArms = data.roboArms || []
        const loadedGrids = data.grids || []
        loadedGantries.forEach((it) => bumpCounter(nextId, 'gantry', it.id))
        loadedArms.forEach((it) => bumpCounter(nextId, 'arm', it.id))
        loadedGrids.forEach((it) => bumpCounter(nextId, 'grid', it.id))
        setGantries(loadedGantries)
        setArms(loadedArms)
        setGrids(loadedGrids)
        setLoadStatus('loaded')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  // ── Gantry areas (rect) ────────────────────────────────────────────
  const onCreateGantry = (rect) => {
    setGantries((g) => [...g, { id: makeId('gantry'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateGantry = (id, rect) =>
    setGantries((g) => g.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectGantry = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteGantry = (id) => {
    setGantries((g) => g.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  // ── Robo arms (point) ──────────────────────────────────────────────
  const onCreateArm = (point) => {
    setArms((a) => [...a, { id: makeId('arm'), ...point }])
    setActiveTool(null)
  }
  const onUpdateArm = (id, point) =>
    setArms((a) => a.map((it) => (it.id === id ? { ...it, ...point } : it)))
  const onSelectArm = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteArm = (id) => {
    setArms((a) => a.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  // ── Grid areas (rect) ──────────────────────────────────────────────
  const onCreateGrid = (rect) => {
    setGrids((g) => [...g, { id: makeId('grid'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateGrid = (id, rect) =>
    setGrids((g) => g.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectGrid = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteGrid = (id) => {
    setGrids((g) => g.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  const onDeselect = () => setSelectedId(null)

  const config = useMemo(() => ({
    gantryRobots: gantries.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
    roboArms: arms.map(({ id, x, z }) => ({ id, x: round(x), z: round(z) })),
    grids: grids.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
  }), [gantries, arms, grids])

  return (
    <div className="planner-app">
      <div className="planner-top">
        <Panel
          gantries={gantries} arms={arms} grids={grids}
          activeTool={activeTool} setActiveTool={setActiveTool}
          selectedId={selectedId}
          onSelectGantry={onSelectGantry} onDeleteGantry={onDeleteGantry}
          onSelectArm={onSelectArm} onDeleteArm={onDeleteArm}
          onSelectGrid={onSelectGrid} onDeleteGrid={onDeleteGrid}
        />
        <SitePlannerScene
          activeTool={activeTool}
          gantries={gantries} arms={arms} grids={grids}
          selectedId={selectedId}
          onCreateGantry={onCreateGantry} onSelectGantry={onSelectGantry} onUpdateGantry={onUpdateGantry}
          onCreateArm={onCreateArm} onSelectArm={onSelectArm} onUpdateArm={onUpdateArm}
          onCreateGrid={onCreateGrid} onSelectGrid={onSelectGrid} onUpdateGrid={onUpdateGrid}
          onDeselect={onDeselect}
        />
      </div>
      <JsonBar config={config} loadStatus={loadStatus} onReload={loadConfig} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
