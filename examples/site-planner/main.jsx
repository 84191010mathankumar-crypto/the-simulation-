import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import SitePlannerScene from './SitePlannerScene'
import '../warehouse/Panel.css'
import './site-planner.css'

const round = (n) => Math.round(n * 100) / 100
const CONFIG_URL = `${import.meta.env.BASE_URL}site-config.json`

function bumpCounter(nextId, type, id) {
  const n = Number(String(id).split('-').pop())
  if (Number.isFinite(n) && n >= nextId.current[type]) nextId.current[type] = n + 1
}

function App() {
  const [gantries, setGantries] = useState([])
  const [arms, setArms] = useState([])
  const [grids, setGrids] = useState([])
  const [zones, setZones] = useState([])   // restricted zones
  const [activeTool, setActiveTool] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loadStatus, setLoadStatus] = useState('loading')
  const [showModel, setShowModel] = useState(true)

  const nextId = useRef({ gantry: 1, arm: 1, grid: 1, zone: 1 })
  const makeId = (type) => `${type}-${nextId.current[type]++}`

  const loadConfig = useCallback(() => {
    setLoadStatus('loading')
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) { setLoadStatus('empty'); return }
        const loadedGantries = data.gantryRobots    || []
        const loadedArms     = data.roboArms         || []
        const loadedGrids    = data.grids            || []
        const loadedZones    = data.restrictedZones  || []
        loadedGantries.forEach((it) => bumpCounter(nextId, 'gantry', it.id))
        loadedArms.forEach((it)     => bumpCounter(nextId, 'arm',    it.id))
        loadedGrids.forEach((it)    => bumpCounter(nextId, 'grid',   it.id))
        loadedZones.forEach((it)    => bumpCounter(nextId, 'zone',   it.id))
        setGantries(loadedGantries)
        setArms(loadedArms)
        setGrids(loadedGrids)
        setZones(loadedZones)
        setLoadStatus('loaded')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  // ── Gantry areas ──────────────────────────────────────────────
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

  // ── Robo arms ─────────────────────────────────────────────────
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

  // ── Grid areas ─────────────────────────────────────────────────
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

  // ── Restricted zones ───────────────────────────────────────────
  const onCreateZone = (rect) => {
    setZones((z) => [...z, { id: makeId('zone'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateZone = (id, rect) =>
    setZones((z) => z.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectZone = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteZone = (id) => {
    setZones((z) => z.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  const onDeselect = () => setSelectedId(null)

  // Arm is valid when it lies inside at least one grid AND outside all restricted zones.
  const isArmValid = useCallback((arm) => {
    const onGrid = grids.some((g) =>
      arm.x >= g.minX && arm.x <= g.maxX && arm.z >= g.minZ && arm.z <= g.maxZ
    )
    const blocked = zones.some((z) =>
      arm.x >= z.minX && arm.x <= z.maxX && arm.z >= z.minZ && arm.z <= z.maxZ
    )
    return onGrid && !blocked
  }, [grids, zones])

  const config = useMemo(() => ({
    gantryRobots: gantries.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
    roboArms: arms.map(({ id, x, z }) => ({ id, x: round(x), z: round(z) })),
    grids: grids.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
    restrictedZones: zones.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
  }), [gantries, arms, grids, zones])

  return (
    <div className="planner-app">
      <Panel
        gantries={gantries} arms={arms} grids={grids} zones={zones}
        activeTool={activeTool} setActiveTool={setActiveTool}
        selectedId={selectedId}
        onSelectGantry={onSelectGantry} onDeleteGantry={onDeleteGantry}
        onSelectArm={onSelectArm} onDeleteArm={onDeleteArm}
        onSelectGrid={onSelectGrid} onDeleteGrid={onDeleteGrid}
        onSelectZone={onSelectZone} onDeleteZone={onDeleteZone}
        showModel={showModel} onToggleModel={() => setShowModel((v) => !v)}
        config={config} loadStatus={loadStatus} onReload={loadConfig}
      />
      <SitePlannerScene
        showModel={showModel}
        activeTool={activeTool}
        gantries={gantries} arms={arms} grids={grids} zones={zones}
        selectedId={selectedId}
        isArmValid={isArmValid}
        onCreateGantry={onCreateGantry} onSelectGantry={onSelectGantry} onUpdateGantry={onUpdateGantry}
        onCreateArm={onCreateArm} onSelectArm={onSelectArm} onUpdateArm={onUpdateArm}
        onCreateGrid={onCreateGrid} onSelectGrid={onSelectGrid} onUpdateGrid={onUpdateGrid}
        onCreateZone={onCreateZone} onSelectZone={onSelectZone} onUpdateZone={onUpdateZone}
        onDeselect={onDeselect}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
