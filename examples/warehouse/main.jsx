/**
 * examples/warehouse — multi-robot pick-and-place demo.
 *
 * What this file does:
 *   1. Reads the scenario from ./script.js (boxes + their from/to/grab).
 *   2. Spins up N per-robot zustand stores via the lib's createRobotStore().
 *   3. Hands those stores to <RobotStoreProvider> blocks in the scene so each
 *      <RobotArm> + <AnimationController> drives its own arm.
 *   4. Runs a small scheduler (./scheduler.js) that assigns boxes to robots
 *      by nearest distance and parents the box mesh under the gripper during
 *      transport.
 *
 * The robots' arm motion comes verbatim from the same lib components the
 * main demo uses — no fork of the IK or animation logic.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import { createRobotStore } from 'robo-playground'

import WarehouseScene from './WarehouseScene'
import Panel from './Panel'
import { SCENARIOS, ROOM_SIZE, DEFAULT_CUSTOM_CODE, parseCustomCode } from './script'
import { createScheduler } from './scheduler'

import './Panel.css'

const ROBOT_COLORS = ['#ff6000','#3b82f6','#10b981','#a855f7','#f43f5e','#eab308']

/* Lay out N robots along a row inside the room, away from the boxes. */
function makeRobotHomes(n, roomSize) {
  const margin = 2
  const z = -roomSize / 2 + margin     // line them up against the south wall
  const homes = []
  for (let i = 0; i < n; i++) {
    const x = (n === 1) ? 0
            : (-roomSize / 2 + margin) + (i / (n - 1)) * (roomSize - 2 * margin)
    homes.push([x, 0, z])
  }
  return homes
}

function App() {
  const [robotCount, setRobotCount] = useState(2)
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [loadedCount, setLoadedCount] = useState(0)
  const [customCode, setCustomCode] = useState(DEFAULT_CUSTOM_CODE)
  const [gridMovement, setGridMovement] = useState(true)
  const [showPaths, setShowPaths] = useState(false)
  const [pathResetKey, setPathResetKey] = useState(0)

  const [zones, setZones] = useState([])
  const [zoneToolActive, setZoneToolActive] = useState(false)
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const zoneIdRef = useRef(0)

  const onCreateZone = useCallback((rect) => {
    const id = `zone-${zoneIdRef.current++}`
    setZones((zs) => [...zs, { id, ...rect }])
    setZoneToolActive(false)
    setSelectedZoneId(id)
  }, [])
  const onUpdateZone = useCallback((id, patch) => {
    setZones((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  }, [])
  const onSelectZone = useCallback((id) => setSelectedZoneId(id), [])
  const onDeselectZone = useCallback(() => setSelectedZoneId(null), [])
  const onDeleteZone = useCallback((id) => {
    setZones((zs) => zs.filter((z) => z.id !== id))
    setSelectedZoneId((sel) => (sel === id ? null : sel))
  }, [])

  // Live-parse the user's script.  On parse failure we keep whatever boxes
  // last parsed successfully so the scene doesn't blink to empty mid-keystroke.
  const lastGoodCustomBoxesRef = useRef(null)
  const customParse = useMemo(() => parseCustomCode(customCode), [customCode])
  if (customParse.boxes) lastGoodCustomBoxesRef.current = customParse.boxes
  const customBoxes = lastGoodCustomBoxesRef.current || []

  const customScenario = useMemo(() => ({
    id: 'custom',
    name: 'Custom',
    description: customParse.error
      ? `Custom · ${customParse.error}`
      : `Custom · ${customBoxes.length} pieces`,
    roomSize: ROOM_SIZE,
    boxes: customBoxes,
  }), [customBoxes, customParse.error])

  const allScenarios = useMemo(() => [...SCENARIOS, customScenario], [customScenario])

  const scenario = useMemo(
    () => allScenarios.find((s) => s.id === scenarioId) || allScenarios[0],
    [scenarioId, allScenarios],
  )
  const scenarioBoxes = scenario.boxes

  const [taskCounts, setTaskCounts] = useState({ pending: scenarioBoxes.length, assigned: 0, done: 0 })

  /* Stable bank of stores — grow on demand, never shrink.
   *
   * If we recreated stores from scratch on every count change, existing
   * RobotArm components (preserved by React because their `key` matched)
   * would still hold the OLD store's actions in their load-effect closure.
   * The URDF would load and call setRobotLoaded on a dead store; the UI's
   * subscription to the new store would never see `robotLoaded=true` and
   * Start would be stuck on "Loading 1/5...".  Keeping stores stable per
   * slot makes the load + UI agree on the same object.
   */
  const storesRef = useRef([])
  const robots = useMemo(() => {
    while (storesRef.current.length < robotCount) {
      storesRef.current.push(createRobotStore())
    }
    const homes = makeRobotHomes(robotCount, ROOM_SIZE)
    return homes.map((home, i) => {
      const store = storesRef.current[i]
      // Always re-apply the home (it depends on count) and turn mobile mode on.
      // robotLoaded / robotRef are preserved if the URDF is already in scene.
      store.setState({
        mobileMode: true,
        parkingRef: 'self',
        platformPose: { position: home, rotation: [0, 0, 0] },
        homePlatform: { position: home, rotation: [0, 0, 0] },
      })
      return { id: `R${i+1}`, store, color: ROBOT_COLORS[i % ROBOT_COLORS.length], home }
    })
  }, [robotCount])

  // Push the grid-movement toggle and the restricted zones into every
  // robot's store as they change — same pattern as mobileMode above, just
  // decoupled from robotCount.
  useEffect(() => {
    for (const r of robots) r.store.setState({ gridMovement })
  }, [robots, gridMovement])
  useEffect(() => {
    for (const r of robots) r.store.setState({ zones })
  }, [robots, zones])

  // Each box has a ref into the scene mesh so the scheduler can reparent it.
  const meshRefs = useRef(new Map())
  const registerMeshRef = useCallback((id, ref) => {
    if (ref) meshRefs.current.set(id, ref)
    else meshRefs.current.delete(id)
  }, [])

  // Re-build the boxes-with-meshRef list when the scenario changes.
  const boxesForScene = useMemo(() => scenarioBoxes.map((b) => ({ ...b })), [scenarioBoxes])
  const boxesForScheduler = useMemo(
    () => scenarioBoxes.map((b) => ({ ...b, meshRef: { get current() { return meshRefs.current.get(b.id) } } })),
    [scenarioBoxes]
  )

  // Local log function — also called by the scheduler.
  const pushLog = useCallback((level, msg) => {
    setLogs((cur) => [{ id: Date.now() + Math.random(), ts: performance.now(), level, msg }, ...cur].slice(0, 200))
  }, [])

  // Scheduler is recreated when robot list changes.
  const scheduler = useMemo(
    () => createScheduler({ robots, boxes: boxesForScheduler, onLog: pushLog }),
    [robots, boxesForScheduler, pushLog]
  )

  // Keep status counters fresh while running.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      const counts = { pending: 0, assigned: 0, done: 0 }
      for (const task of scheduler.tasks) counts[task.state] = (counts[task.state] || 0) + 1
      setTaskCounts(counts)
      if (!scheduler.isRunning()) setRunning(false)
    }, 200)
    return () => clearInterval(t)
  }, [running, scheduler])

  // Subscribe to each robot's `robotLoaded` flag so the Start button can stay
  // disabled until every URDF finished loading.  When the slider changes, we
  // rebuild subscriptions and reset the counter.
  useEffect(() => {
    setLoadedCount(robots.filter((r) => r.store.getState().robotLoaded).length)
    const unsubs = robots.map((r) => r.store.subscribe(
      (s) => s.robotLoaded,
      () => {
        setLoadedCount(robots.filter((x) => x.store.getState().robotLoaded).length)
      },
    ))
    return () => { for (const u of unsubs) u() }
  }, [robots])

  const onStart = () => {
    setRunning(true)
    scheduler.start()
  }
  const onReset = () => {
    scheduler.reset()
    setLogs([])
    setRunning(false)
    setTaskCounts({ pending: scenarioBoxes.length, assigned: 0, done: 0 })
    setPathResetKey((k) => k + 1)
  }

  // When the user picks a different scenario, reset everything so the new
  // boxes appear in their pickup positions and the scheduler restarts.
  const onScenarioChange = (id) => {
    if (running) return
    setScenarioId(id)
    setLogs([])
    setTaskCounts({
      pending: (allScenarios.find((s) => s.id === id) || allScenarios[0]).boxes.length,
      assigned: 0, done: 0,
    })
  }

  // Live custom-script edits change the box list under us — reflect the new
  // pending count in the ledger so the UI stays honest (only while idle).
  useEffect(() => {
    if (running) return
    if (scenarioId !== 'custom') return
    setTaskCounts({ pending: scenarioBoxes.length, assigned: 0, done: 0 })
  }, [scenarioBoxes, running, scenarioId])

  const onCustomCodeChange = useCallback((code) => {
    if (running) return
    setCustomCode(code)
  }, [running])

  return (
    <div className="app">
      <Panel
        robotCount={robotCount}
        setRobotCount={setRobotCount}
        scenarios={allScenarios}
        scenarioId={scenarioId}
        onScenarioChange={onScenarioChange}
        onStart={onStart}
        onReset={onReset}
        running={running}
        taskCounts={taskCounts}
        logs={logs}
        loadedCount={loadedCount}
        robotsTotal={robots.length}
        customCode={customCode}
        onCustomCodeChange={onCustomCodeChange}
        customError={customParse.error}
        gridMovement={gridMovement}
        setGridMovement={setGridMovement}
        showPaths={showPaths}
        setShowPaths={setShowPaths}
        zones={zones}
        zoneToolActive={zoneToolActive}
        setZoneToolActive={setZoneToolActive}
        onDeleteZone={onDeleteZone}
        onSelectZone={onSelectZone}
        selectedZoneId={selectedZoneId}
      />
      <WarehouseScene
        robots={robots}
        boxes={boxesForScene}
        scheduler={scheduler}
        roomSize={ROOM_SIZE}
        registerMeshRef={registerMeshRef}
        gridMovement={gridMovement}
        showPaths={showPaths}
        pathResetKey={pathResetKey}
        zones={zones}
        zoneToolActive={zoneToolActive}
        selectedZoneId={selectedZoneId}
        onCreateZone={onCreateZone}
        onSelectZone={onSelectZone}
        onUpdateZone={onUpdateZone}
        onDeselectZone={onDeselectZone}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
