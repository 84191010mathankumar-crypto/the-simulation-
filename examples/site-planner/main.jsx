import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { createRobotStore, createGantryStore } from 'robo-playground'
import Panel from './Panel'
import SitePlannerScene from './SitePlannerScene'
import { createScheduler } from '../warehouse/scheduler'
import { createGantryScheduler } from '../warehouse/gantryScheduler'
import { buildSimulation, sourceKey } from './simulation'
import '../warehouse/Panel.css'
import './site-planner.css'

const round = (n) => Math.round(n * 100) / 100

// Minimum centre-to-centre distance between arm bases (metres).
// The KR210 body extends ~0.9 m from its axis; 2.5 m gives a clear gap.
const MIN_ARM_SPACING = 2.5
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
  const [boxSizeCm, setBoxSizeCm]     = useState(60)
  const [activeTool, setActiveTool]   = useState(null)
  const [selectedId, setSelectedId]   = useState(null)
  const [loadStatus, setLoadStatus]   = useState('loading')
  const [showModel, setShowModel]     = useState(false)
  const [simulating, setSimulating]   = useState(false)
  const [simDone, setSimDone]         = useState(false)
  const [robotType, setRobotType]     = useState('arms')   // 'arms' | 'gantry'
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
        if (data.boxSizeCm) setBoxSizeCm(data.boxSizeCm)
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
  // Adds an arm at the next position in the row, always anchored to the
  // top-right corner of the largest grid (just outside the top edge).
  // Arm 0 → (g.maxX, g.minZ − 0.5), arm 1 → (g.maxX − 2.5, g.minZ − 0.5), etc.
  const onAddArm = useCallback(() => {
    if (grids.length === 0) {
      setArms((prev) => [...prev, { id: makeId('arm'), x: 0, z: 0 }])
      return
    }

    // Largest grid is the fixed reference (the main navigation floor).
    const g = grids.reduce((best, cur) => {
      const area = (cur.maxX - cur.minX) * (cur.maxZ - cur.minZ)
      return (!best || area > (best.maxX - best.minX) * (best.maxZ - best.minZ)) ? cur : best
    }, null)

    const OFFSET = 0.5  // metres outside the grid boundary

    setArms((prev) => {
      if (prev.length === 0) {
        // First arm: top-right corner, just outside the top (minZ) edge.
        return [...prev, { id: makeId('arm'), x: g.maxX, z: g.minZ - OFFSET }]
      }

      const xs = prev.map((a) => a.x)
      const zs = prev.map((a) => a.z)
      const xRange = Math.max(...xs) - Math.min(...xs)
      const zRange = Math.max(...zs) - Math.min(...zs)

      let newX, newZ
      if (xRange >= zRange) {
        // X-dominant row (along top/bottom edge) → extend leftward.
        newX = Math.min(...xs) - MIN_ARM_SPACING
        newZ = zs.reduce((s, v) => s + v, 0) / zs.length
      } else {
        // Z-dominant row (along left/right edge) → extend downward.
        newX = xs.reduce((s, v) => s + v, 0) / xs.length
        newZ = Math.max(...zs) + MIN_ARM_SPACING
      }

      return [...prev, { id: makeId('arm'), x: newX, z: newZ }]
    })
  }, [grids])

  const onCreateArm = (point) => {
    // Scene-click fallback: snap to the existing row line then place.
    setArms((prev) => {
      let { x, z } = point
      if (prev.length >= 1) {
        const xs = prev.map((a) => a.x)
        const zs = prev.map((a) => a.z)
        const xRange = Math.max(...xs) - Math.min(...xs)
        const zRange = Math.max(...zs) - Math.min(...zs)
        if (xRange >= zRange) {
          z = zs.reduce((s, v) => s + v, 0) / zs.length
        } else {
          x = xs.reduce((s, v) => s + v, 0) / xs.length
        }
      }
      return [...prev, { id: makeId('arm'), x, z }]
    })
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

  // Arm is valid when it is outside all restricted zones and at least
  // MIN_ARM_SPACING away from every other arm.  Grid membership is NOT required
  // — arms are intentionally placed just outside the grid edge.
  const isArmValid = useCallback((arm) => {
    const blocked = zones.some((z) =>
      arm.x >= z.minX && arm.x <= z.maxX && arm.z >= z.minZ && arm.z <= z.maxZ
    )
    // arm.id is undefined for a proposed new placement → checks against all existing arms.
    const tooClose = arms.some((a) =>
      a.id !== arm.id && Math.hypot(a.x - arm.x, a.z - arm.z) < MIN_ARM_SPACING
    )
    return !blocked && !tooClose
  }, [zones, arms])

  // Auto-row: when arms overlap, snap the whole row just outside the nearest
  // edge of the nearest grid, starting at the closest corner and extending
  // along the edge — so arms are parallel to the grid but outside it.
  const justSpread = useRef(false)
  useEffect(() => {
    if (justSpread.current) { justSpread.current = false; return }
    if (arms.length < 2) return
    const anyOverlap = arms.some((a, i) =>
      arms.some((b, j) => j > i && Math.hypot(a.x - b.x, a.z - b.z) < MIN_ARM_SPACING)
    )
    if (!anyOverlap) return

    const moved = arms.map((a) => ({ ...a }))
    const xs = moved.map((a) => a.x)
    const zs = moved.map((a) => a.z)
    const cx = xs.reduce((s, v) => s + v, 0) / xs.length
    const cz = zs.reduce((s, v) => s + v, 0) / zs.length

    if (grids.length > 0) {
      // Find the grid whose boundary is nearest to the arm cluster centroid.
      const g = grids.reduce((best, cur) => {
        const dx = Math.max(0, cur.minX - cx, cx - cur.maxX)
        const dz = Math.max(0, cur.minZ - cz, cz - cur.maxZ)
        const d  = dx * dx + dz * dz
        return (!best || d < best.d) ? { g: cur, d } : best
      }, null).g

      // Which edge of that grid is closest to the arm cluster?
      const dLeft   = Math.abs(cx - g.minX)
      const dRight  = Math.abs(cx - g.maxX)
      const dTop    = Math.abs(cz - g.minZ)
      const dBottom = Math.abs(cz - g.maxZ)
      const nearest = Math.min(dLeft, dRight, dTop, dBottom)

      // Place arms OUTSIDE the nearest edge, starting from the closest corner.
      const OFFSET = 0.5  // metres outside the grid boundary
      if (nearest === dLeft || nearest === dRight) {
        // Vertical edge (left or right) — row runs along Z outside the grid.
        const fx = nearest === dLeft ? g.minX - OFFSET : g.maxX + OFFSET
        // Start from whichever Z corner is nearest to the arm cluster.
        if (cz >= (g.minZ + g.maxZ) / 2) {
          // Near the bottom corner → arm 0 at maxZ, extend upward (decreasing Z)
          moved.forEach((arm, i) => { arm.x = fx; arm.z = g.maxZ - i * MIN_ARM_SPACING })
        } else {
          // Near the top corner → arm 0 at minZ, extend downward (increasing Z)
          moved.forEach((arm, i) => { arm.x = fx; arm.z = g.minZ + i * MIN_ARM_SPACING })
        }
      } else {
        // Horizontal edge (top or bottom) — row runs along X outside the grid.
        const fz = nearest === dTop ? g.minZ - OFFSET : g.maxZ + OFFSET
        // Start from whichever X corner is nearest to the arm cluster.
        if (cx >= (g.minX + g.maxX) / 2) {
          // Near the right corner → arm 0 at maxX, extend leftward (decreasing X)
          moved.forEach((arm, i) => { arm.x = g.maxX - i * MIN_ARM_SPACING; arm.z = fz })
        } else {
          // Near the left corner → arm 0 at minX, extend rightward (increasing X)
          moved.forEach((arm, i) => { arm.x = g.minX + i * MIN_ARM_SPACING; arm.z = fz })
        }
      }
    } else {
      // No grids yet — fall back to dominant-axis row.
      const xRange = Math.max(...xs) - Math.min(...xs)
      const zRange = Math.max(...zs) - Math.min(...zs)
      if (xRange >= zRange) {
        moved.sort((a, b) => a.x - b.x)
        const avgZ = zs.reduce((s, v) => s + v, 0) / zs.length
        moved.forEach((arm, i) => { arm.x = moved[0].x + i * MIN_ARM_SPACING; arm.z = avgZ })
      } else {
        moved.sort((a, b) => a.z - b.z)
        const avgX = xs.reduce((s, v) => s + v, 0) / xs.length
        moved.forEach((arm, i) => { arm.x = avgX; arm.z = moved[0].z + i * MIN_ARM_SPACING })
      }
    }

    justSpread.current = true
    setArms(moved.map(({ id, x, z }) => ({ id, x, z })))
  }, [arms, grids])

  // ── Simulation ─────────────────────────────────────────────────
  // Storage areas supply boxes; build cubes are the targets.  The arms ride
  // AGVs and follow grid lines (handled by the lib AnimationController) while
  // a warehouse-style scheduler assigns the pick-and-place tasks.
  const unit = boxSizeCm / 100
  const gridUnit = gridSizeCm / 100

  // Anchor the AGV's grid lattice to the floor grid's cell centres so the
  // robots travel along the same lines the boxes sit on.
  const gridOrigin = useMemo(() => {
    const g = grids[0]
    if (!g) return [0, 0]
    return [g.minX + gridUnit / 2, g.minZ + gridUnit / 2]
  }, [grids, gridUnit])

  const sim = useMemo(
    () => buildSimulation({ buildCubes, storageAreas, unit, gantries, robotMode: robotType }),
    [buildCubes, storageAreas, unit, gantries, robotType]
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
        gridCell: gridUnit,
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

  // Every box is drawn in the scene; the scheduler list adds a live mesh ref.
  const simBoxesForScene = useMemo(() => sim.boxes.map((b) => ({ ...b })), [sim.boxes])
  const simBoxesForScheduler = useMemo(
    () => sim.boxes.map((b) => ({ ...b, meshRef: { get current() { return simMeshRefs.current.get(b.id) } } })),
    [sim.boxes]
  )

  // Source positions consumed by the run, so <StorageVisual> can hide those
  // cubes — the pile depletes as the boxes are carried off.
  const consumedSourceKeys = useMemo(
    () => new Set(sim.boxes.map((b) => sourceKey(b.from))),
    [sim.boxes]
  )

  const pushSimLog = useCallback(() => {}, [])

  // The arm fleet handles every box in arms mode, and the gantry-mode
  // fallbacks (boxes no gantry can reach) otherwise.
  const armBoxes = useMemo(
    () => simBoxesForScheduler.filter((b) => !b.robot || b.robot.type === 'arm'),
    [simBoxesForScheduler]
  )
  const armScheduler = useMemo(
    () => createScheduler({ robots: simRobots, boxes: armBoxes, onLog: pushSimLog }),
    [simRobots, armBoxes, pushSimLog]
  )

  // One animated gantry per gantry area that actually has boxes to place.
  // Each gets its own per-instance store + scheduler so several gantries can
  // run in parallel; `origin` positions the gantry frame over its area.
  const gantryStoresRef = useRef(new Map())
  const gantryInstances = useMemo(() => {
    if (robotType !== 'gantry') return []
    return gantries.map((g) => {
      const boxes = simBoxesForScheduler.filter(
        (b) => b.robot && b.robot.type === 'gantry' && b.robot.gantryId === g.id
      )
      if (boxes.length === 0) return null
      let store = gantryStoresRef.current.get(g.id)
      if (!store) { store = createGantryStore(); gantryStoresRef.current.set(g.id, store) }
      const origin = [(g.minX + g.maxX) / 2, (g.minZ + g.maxZ) / 2]
      const scheduler = createGantryScheduler({ boxes, onLog: pushSimLog, store, origin })
      return {
        id: g.id, store, origin, boxes, scheduler,
        travelX: Math.max(0.4, (g.maxX - g.minX) / 2),
        travelZ: Math.max(0.4, (g.maxZ - g.minZ) / 2),
      }
    }).filter(Boolean)
  }, [robotType, gantries, simBoxesForScheduler, pushSimLog])

  const activeGantryIds = useMemo(() => new Set(gantryInstances.map((g) => g.id)), [gantryInstances])

  // Every scheduler driven this run — the arm fleet plus each active gantry.
  const allSchedulers = useMemo(
    () => [armScheduler, ...gantryInstances.map((g) => g.scheduler)],
    [armScheduler, gantryInstances]
  )

  const onStartSim = useCallback(() => {
    setActiveTool(null)
    setSelectedId(null)
    setSimDone(false)
    setSimulating(true)
    for (const s of allSchedulers) s.start()
  }, [allSchedulers])

  const onStopSim = useCallback(() => {
    for (const s of allSchedulers) s.reset()
    setSimulating(false)
    setSimDone(false)
    setSimProgress({ pending: sim.boxes.length, assigned: 0, done: 0 })
  }, [allSchedulers, sim.boxes.length])

  // Stop the run cleanly if the plan is edited out from under it.
  useEffect(() => {
    if (simulating) { for (const s of allSchedulers) s.reset(); setSimulating(false); setSimDone(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.boxes])

  // Poll task counts while running so the panel can show build progress, and
  // flip to the "done" state once every scheduler has finished its tasks.
  useEffect(() => {
    if (!simulating) return
    const t = setInterval(() => {
      const counts = { pending: 0, assigned: 0, done: 0 }
      let total = 0
      let anyRunning = false
      for (const s of allSchedulers) {
        for (const task of s.tasks) { counts[task.state] = (counts[task.state] || 0) + 1; total++ }
        if (s.isRunning()) anyRunning = true
      }
      setSimProgress(counts)
      if (!anyRunning && total > 0 && counts.done === total) setSimDone(true)
    }, 200)
    return () => clearInterval(t)
  }, [simulating, allSchedulers])

  const config = useMemo(() => ({
    gridSizeCm,
    boxSizeCm,
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
  }), [gridSizeCm, boxSizeCm, gantries, arms, grids, zones, storageAreas, buildCubes])

  return (
    <div className="planner-app">
      <Panel
        gantries={gantries} arms={arms} grids={grids} zones={zones} storageAreas={storageAreas}
        buildCubes={buildCubes} onRemoveBuildCube={onRemoveBuildCube}
        gridSizeCm={gridSizeCm} onChangeGridSize={setGridSizeCm}
        boxSizeCm={boxSizeCm} onChangeBoxSize={setBoxSizeCm}
        activeTool={activeTool} setActiveTool={setActiveTool}
        selectedId={selectedId}
        onSelectGantry={onSelectGantry} onDeleteGantry={onDeleteGantry}
        onAddArm={onAddArm}
        onSelectArm={onSelectArm} onDeleteArm={onDeleteArm}
        onSelectGrid={onSelectGrid} onDeleteGrid={onDeleteGrid}
        onSelectZone={onSelectZone} onDeleteZone={onDeleteZone}
        onSelectStorage={onSelectStorage} onDeleteStorage={onDeleteStorage}
        showModel={showModel} onToggleModel={() => setShowModel((v) => !v)}
        config={config} loadStatus={loadStatus} onReload={loadConfig}
        simulating={simulating} simDone={simDone} onStartSim={onStartSim} onStopSim={onStopSim}
        simStats={sim} simProgress={simProgress} armCount={arms.length}
        gantryCount={gantries.length} robotType={robotType} setRobotType={setRobotType}
      />
      <SitePlannerScene
        showModel={showModel}
        activeTool={activeTool}
        gantries={gantries} arms={arms} grids={grids} zones={zones} storageAreas={storageAreas}
        buildCubes={buildCubes} onAddBuildCube={onAddBuildCube} onRemoveBuildCube={onRemoveBuildCube}
        selectedId={selectedId}
        gridSizeCm={gridSizeCm}
        boxSizeCm={boxSizeCm}
        isArmValid={isArmValid}
        simulating={simulating} simRobots={simRobots} simBoxes={simBoxesForScene}
        gantryInstances={gantryInstances} activeGantryIds={activeGantryIds}
        consumedSourceKeys={consumedSourceKeys} schedulers={allSchedulers}
        registerSimMeshRef={registerSimMeshRef}
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
