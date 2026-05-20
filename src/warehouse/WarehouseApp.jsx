import React, { useState, useEffect, useMemo, useCallback } from 'react'
import WarehousePanel from './WarehousePanel.jsx'
import WarehouseScene from './WarehouseScene.jsx'
import { useRobotInstances } from './RobotInstance.jsx'
import useWarehouseCoordinator from './useWarehouseCoordinator.js'
import { TASKS as DEFAULT_TASKS, ROBOT_DOCKS } from './tasks.js'
import { HOME_ANGLES } from '../lib'

/**
 * Top-level wiring for the warehouse demo.  Owns:
 *   - the list of robots (with stable per-robot stores)
 *   - the active-count slider
 *   - the task list
 *   - the coordinator (running/paused)
 *   - reset semantics
 */
export default function WarehouseApp() {
  // ── Robots ────────────────────────────────────────────────────────────
  // useMemo keeps ROBOT_DOCKS stable across renders so robot stores aren't
  // re-created on every UI tick.
  const docks  = useMemo(() => ROBOT_DOCKS, [])
  const robots = useRobotInstances(docks)
  const maxRobots = docks.length

  const [activeCount, setActiveCount] = useState(3)
  const [running, setRunning]         = useState(false)

  // Reset key — bumped to force a fresh coordinator + fresh task identities.
  // Drives both the coordinator's tasks re-init *and* the box snap-back.
  const [resetKey, setResetKey] = useState(0)
  const tasks = useMemo(() => DEFAULT_TASKS.map((t) => ({ ...t })), [resetKey])

  const snapshot = useWarehouseCoordinator(
    robots.slice(0, activeCount),
    tasks,
    running,
  )

  // Track when every robot finished URDF load so we can light up the "ready" pill.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const handles = robots.slice(0, activeCount).map((r) =>
      r.store.subscribe((s) => s.robotLoaded, () => {
        const allReady = robots.slice(0, activeCount).every((x) => x.store.getState().robotLoaded)
        if (allReady) setReady(true)
      })
    )
    // Re-check on mount in case some robots loaded before we subscribed.
    const allReady = robots.slice(0, activeCount).every((x) => x.store.getState().robotLoaded)
    if (allReady) setReady(true)
    return () => handles.forEach((unsub) => unsub())
  }, [robots, activeCount])

  // Stop the coordinator automatically when everything is done.
  useEffect(() => {
    if (running && snapshot.doneCount === tasks.length) setRunning(false)
  }, [running, snapshot.doneCount, tasks.length])

  // ── Controls ──────────────────────────────────────────────────────────
  const onRun  = useCallback(() => setRunning(true),  [])
  const onStop = useCallback(() => setRunning(false), [])
  const onReset = useCallback(() => {
    setRunning(false)
    // Send every robot back to its home pose with empty animation state.
    for (const r of robots) {
      const api = r.store
      api.setState({
        animState:    'idle',
        animProgress: 0,
        fromAngles:   null,
        toAngles:     null,
        fromPlatform: null,
        toPlatform:   null,
        platformPose: { position: [r.dock[0], 0, r.dock[1]], rotation: [0, 0, 0] },
        platformHome: { position: [r.dock[0], 0, r.dock[1]], rotation: [0, 0, 0] },
        jointAngles:  { ...HOME_ANGLES },
      })
    }
    setResetKey((k) => k + 1)
  }, [robots])

  return (
    <div className="app-layout">
      <WarehousePanel
        robots={robots}
        activeCount={activeCount}
        setActiveCount={setActiveCount}
        maxRobots={maxRobots}
        tasks={tasks}
        snapshot={snapshot}
        running={running}
        onRun={onRun}
        onStop={onStop}
        onReset={onReset}
        ready={ready}
      />
      <WarehouseScene
        robots={robots}
        activeCount={activeCount}
        tasks={tasks}
        taskSnapshot={snapshot}
      />
    </div>
  )
}
