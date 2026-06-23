import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createRobotStore } from 'robo-playground'
import Panel from './Panel'
import SitePlannerScene from './SitePlannerScene'
import { createScheduler } from '../warehouse/scheduler'
import { buildSimulation } from './simulation'
import '../warehouse/Panel.css'
import './site-planner.css'

const round = (n) => Math.round(n * 100) / 100
const CONFIG_URL = `${import.meta.env.BASE_URL}site-config.json`

function bumpCounter(nextId, type, id) {
  const n = Number(String(id).split('-').pop())
  if (Number.isFinite(n) && n >= nextId.current[type]) nextId.current[type] = n + 1
}

function App() {
  const [gantries, setGantries]       = useState([])
  const [arms, setArms]               = useState([])
  const [grids, setGrids]             = useState([])
  const [zones, setZones]             = useState([])
  const [storageAreas, setStorage]    = useState([])
  const [buildCubes, setBuildCubes]   = useState([])
  const [gridSizeCm, setGridSizeCm]   = useState(60)
  const [activeTool, setActiveTool]   = useState(null)
  const [selectedId, setSelectedId]   = useState(null)
  const [loadStatus, setLoadStatus]   = useState('loading')
  const [showModel, setShowModel]     = useState(false)
  const [simulating, setSimulating]   = useState(false)
  const [simProgress, setSimProgress] = useState({ pending: 0, assigned: 0, done: 0 })

  const nextId = useRef({ gantry: 1, arm: 1, grid: 1, zone: 1, storage: 1, build: 1 })
  const makeId = (type) => `${type}-${nextId.current[type]++}`

  const loadConfig = useCallback(() => {
    setLoadStatus('loading')
    fetch(CONFIG_URL, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) { setLoadStatus('empty'); return }
        const g = data.gantryRobots   || []
        const a = data.roboArms       || []
        const gr = data.grids         || []
        const z = data.restrictedZones || []
        const s = data.storageAreas   || []
        const b = data.buildCubes     || []
        g.forEach((it)  => bumpCounter(nextId, 'gantry',  it.id))
        a.forEach((it)  => bumpCounter(nextId, 'arm',     it.id))
        gr.forEach((it) => bumpCounter(nextId, 'grid',    it.id))
        z.forEach((it)  => bumpCounter(nextId, 'zone',    it.id))
        s.forEach((it)  => bumpCounter(nextId, 'storage', it.id))
        b.forEach((it)  => bumpCounter(nextId, 'build',   it.id))
        setGantries(g)
        setArms(a)
        setGrids(gr)
        setZones(z)
        setStorage(s)
        setBuildCubes(b)
        if (data.gridSizeCm) setGridSizeCm(data.gridSizeCm)
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

  // ── Build cubes ────────────────────────────────────────────────
  const onAddBuildCube = (x, z, layer) => {
    setBuildCubes((prev) => {
      if (prev.some((c) => c.x === x && c.z === z && c.layer === layer)) return prev
      return [...prev, { id: makeId('build'), x, z, layer }]
    })
  }
  const onRemoveBuildCube = (id) =>
    setBuildCubes((prev) => prev.filter((c) => c.id !== id))

  // ── Storage areas ──────────────────────────────────────────────
  const onCreateStorage = (rect) => {
    setStorage((s) => [...s, { id: makeId('storage'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateStorage = (id, rect) =>
    setStorage((s) => s.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectStorage = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteStorage = (id) => {
    setStorage((s) => s.filter((it) => it.id !== id))
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

  // ── Simulation ─────────────────────────────────────────────────
  // Storage areas supply boxes; build cubes are the targets.  The arms ride
  // AGVs and follow grid lines (handled by the lib AnimationController) while
  // a warehouse-style scheduler assigns the pick-and-place tasks.
  const unit = gridSizeCm / 100

  // Anchor the AGV's grid lattice to the floor grid's cell centres so the
  // robots travel along the same lines the boxes sit on.
  const gridOrigin = useMemo(() => {
    const g = grids[0]
    if (!g) return [0, 0]
    return [g.minX + unit / 2, g.minZ + unit / 2]
  }, [grids, unit])

  const sim = useMemo(
    () => buildSimulation({ buildCubes, storageAreas, unit }),
    [buildCubes, storageAreas, unit]
  )

  // One stable store per arm — created on demand, reused across renders so a
  // loaded URDF isn't thrown away when an unrelated bit of state changes.
  const storesRef = useRef(new Map())
  const simRobots = useMemo(() => arms.map((a) => {
    let store = storesRef.current.get(a.id)
    if (!store) { store = createRobotStore(); storesRef.current.set(a.id, store) }
    return { id: a.id, store, home: [a.x, 0, a.z] }
  }), [arms])

  // Push mobile-mode + grid settings into each arm's store as they change.
  useEffect(() => {
    const zoneList = zones.map((z) => ({ minX: z.minX, maxX: z.maxX, minZ: z.minZ, maxZ: z.maxZ }))
    for (const r of simRobots) {
      r.store.setState({
        mobileMode: true,
        parkingRef: 'self',
        gridMovement: true,
        gridCell: unit,
        gridOrigin,
        zones: zoneList,
        platformPose: { position: r.home, rotation: [0, 0, 0] },
        homePlatform: { position: r.home, rotation: [0, 0, 0] },
      })
    }
  }, [simRobots, unit, gridOrigin, zones])

  // Each carried box exposes a live ref into its scene mesh for the scheduler.
  const simMeshRefs = useRef(new Map())
  const registerSimMeshRef = useCallback((id, ref) => {
    if (ref) simMeshRefs.current.set(id, ref)
    else simMeshRefs.current.delete(id)
  }, [])

  const simBoxesForScene = useMemo(() => sim.boxes.map((b) => ({ ...b })), [sim.boxes])
  const simBoxesForScheduler = useMemo(
    () => sim.boxes.map((b) => ({ ...b, meshRef: { get current() { return simMeshRefs.current.get(b.id) } } })),
    [sim.boxes]
  )

  const pushSimLog = useCallback(() => {}, [])
  const simScheduler = useMemo(
    () => createScheduler({ robots: simRobots, boxes: simBoxesForScheduler, onLog: pushSimLog }),
    [simRobots, simBoxesForScheduler, pushSimLog]
  )

  const onStartSim = useCallback(() => {
    setActiveTool(null)
    setSelectedId(null)
    setSimulating(true)
    simScheduler.start()
  }, [simScheduler])

  const onStopSim = useCallback(() => {
    simScheduler.reset()
    setSimulating(false)
    setSimProgress({ pending: sim.boxes.length, assigned: 0, done: 0 })
  }, [simScheduler, sim.boxes.length])

  // Stop the run cleanly if the plan is edited out from under it.
  useEffect(() => {
    if (simulating) { simScheduler.reset(); setSimulating(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.boxes])

  // Poll task counts while running so the panel can show build progress.
  useEffect(() => {
    if (!simulating) return
    const t = setInterval(() => {
      const counts = { pending: 0, assigned: 0, done: 0 }
      for (const task of simScheduler.tasks) counts[task.state] = (counts[task.state] || 0) + 1
      setSimProgress(counts)
    }, 200)
    return () => clearInterval(t)
  }, [simulating, simScheduler])

  const config = useMemo(() => ({
    gridSizeCm,
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
    storageAreas: storageAreas.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
    buildCubes: buildCubes.map(({ id, x, z, layer }) => ({ id, x: round(x), z: round(z), layer })),
  }), [gridSizeCm, gantries, arms, grids, zones, storageAreas, buildCubes])

  return (
    <div className="planner-app">
      <Panel
        gantries={gantries} arms={arms} grids={grids} zones={zones} storageAreas={storageAreas}
        buildCubes={buildCubes} onRemoveBuildCube={onRemoveBuildCube}
        gridSizeCm={gridSizeCm} onChangeGridSize={setGridSizeCm}
        activeTool={activeTool} setActiveTool={setActiveTool}
        selectedId={selectedId}
        onSelectGantry={onSelectGantry} onDeleteGantry={onDeleteGantry}
        onSelectArm={onSelectArm} onDeleteArm={onDeleteArm}
        onSelectGrid={onSelectGrid} onDeleteGrid={onDeleteGrid}
        onSelectZone={onSelectZone} onDeleteZone={onDeleteZone}
        onSelectStorage={onSelectStorage} onDeleteStorage={onDeleteStorage}
        showModel={showModel} onToggleModel={() => setShowModel((v) => !v)}
        config={config} loadStatus={loadStatus} onReload={loadConfig}
        simulating={simulating} onStartSim={onStartSim} onStopSim={onStopSim}
        simStats={sim} simProgress={simProgress} armCount={arms.length}
      />
      <SitePlannerScene
        showModel={showModel}
        activeTool={activeTool}
        gantries={gantries} arms={arms} grids={grids} zones={zones} storageAreas={storageAreas}
        buildCubes={buildCubes} onAddBuildCube={onAddBuildCube} onRemoveBuildCube={onRemoveBuildCube}
        selectedId={selectedId}
        gridSizeCm={gridSizeCm}
        isArmValid={isArmValid}
        simulating={simulating} simRobots={simRobots} simBoxes={simBoxesForScene}
        simScheduler={simScheduler} registerSimMeshRef={registerSimMeshRef}
        onCreateGantry={onCreateGantry} onSelectGantry={onSelectGantry} onUpdateGantry={onUpdateGantry} onDeleteGantry={onDeleteGantry}
        onCreateArm={onCreateArm} onSelectArm={onSelectArm} onUpdateArm={onUpdateArm}
        onCreateGrid={onCreateGrid} onSelectGrid={onSelectGrid} onUpdateGrid={onUpdateGrid} onDeleteGrid={onDeleteGrid}
        onCreateZone={onCreateZone} onSelectZone={onSelectZone} onUpdateZone={onUpdateZone} onDeleteZone={onDeleteZone}
        onCreateStorage={onCreateStorage} onSelectStorage={onSelectStorage} onUpdateStorage={onUpdateStorage} onDeleteStorage={onDeleteStorage}
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
