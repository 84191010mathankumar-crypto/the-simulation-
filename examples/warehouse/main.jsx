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
import { createRobotStore } from 'roboclaw'

import WarehouseScene from './WarehouseScene'
import Panel from './Panel'
import { boxes as scenarioBoxes, ROOM_SIZE } from './script'
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
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [taskCounts, setTaskCounts] = useState({ pending: scenarioBoxes.length, assigned: 0, done: 0 })
  const [loadedCount, setLoadedCount] = useState(0)

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

  // Each box has a ref into the scene mesh so the scheduler can reparent it.
  const meshRefs = useRef(new Map())
  const registerMeshRef = useCallback((id, ref) => {
    if (ref) meshRefs.current.set(id, ref)
    else meshRefs.current.delete(id)
  }, [])

  // Re-build the boxes-with-meshRef list each render (cheap, same refs).
  const boxesForScene = useMemo(() => scenarioBoxes.map((b) => ({ ...b })), [])
  const boxesForScheduler = useMemo(
    () => scenarioBoxes.map((b) => ({ ...b, meshRef: { get current() { return meshRefs.current.get(b.id) } } })),
    []
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
  }

  return (
    <div className="app">
      <Panel
        robotCount={robotCount}
        setRobotCount={setRobotCount}
        onStart={onStart}
        onReset={onReset}
        running={running}
        taskCounts={taskCounts}
        logs={logs}
        loadedCount={loadedCount}
        robotsTotal={robots.length}
      />
      <WarehouseScene
        robots={robots}
        boxes={boxesForScene}
        scheduler={scheduler}
        roomSize={ROOM_SIZE}
        registerMeshRef={registerMeshRef}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
