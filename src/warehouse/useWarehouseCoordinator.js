import { useEffect, useRef, useState } from 'react'
import { assignNearestPending, pathConflicts } from '../lib'

/**
 * Runtime coordinator that drives N robots through a list of pick-and-place
 * tasks.  Reads each robot's `animState` from its Zustand store to detect
 * when a robot is free, then assigns the closest pending task and writes
 * the next pickup / dropoff into the robot's store to kick off the existing
 * AnimationController pipeline.
 *
 * Avoidance scheme: each assigned task reserves the pickup→dropoff line
 * segment.  A new task is only assigned if its pickup→dropoff segment is
 * at least `SAFETY_DISTANCE` metres away from every active reservation.
 * Conflicting assignments wait one tick and retry.
 *
 * State exposed via `useState` so the UI re-renders on every task transition;
 * the inner refs hold the bookkeeping so the polling tick is allocation-light.
 *
 * @param robots Array of { id, store, dock: [x,z], color } — typically built
 *               by WarehouseScene from ROBOT_DOCKS.
 * @param tasks  Array of { id, from: [x,z], to: [x,z], size, color, label }.
 * @param running Boolean — when false, the coordinator is paused (no new
 *                assignments handed out; in-flight tasks finish naturally).
 */
// Minimum clearance between two robots' planned segments.  The AGV chassis
// is 1.1 m wide so 1.4 m centre-to-centre leaves ~0.3 m of breathing room.
const SAFETY_DISTANCE = 1.4
const TICK_MS         = 150

export default function useWarehouseCoordinator(robots, tasks, running) {
  // The reactive snapshot — what the UI binds to.
  const [snapshot, setSnapshot] = useState(() => initialSnapshot(tasks))

  // The mutable book-keeping — refs so we don't churn React on every tick.
  const stateRef = useRef({
    taskStatus:   new Map(),   // taskId -> 'pending' | 'assigned' | 'done'
    assignedTo:   new Map(),   // robotId -> taskId
    reservations: new Map(),   // robotId -> { from: [x,z], to: [x,z] }
    carriedBy:    new Map(),   // taskId -> robotId | null  (for box rendering)
    initialised:  false,
  })

  // (Re-)initialise whenever the task list identity changes.
  useEffect(() => {
    const s = stateRef.current
    s.taskStatus.clear()
    s.assignedTo.clear()
    s.reservations.clear()
    s.carriedBy.clear()
    for (const t of tasks) s.taskStatus.set(t.id, 'pending')
    s.initialised = true
    setSnapshot(initialSnapshot(tasks))
  }, [tasks])

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => tick(robots, tasks, stateRef.current, setSnapshot), TICK_MS)
    return () => clearInterval(id)
  }, [running, robots, tasks])

  return snapshot
}

function initialSnapshot(tasks) {
  return {
    taskStatus:   Object.fromEntries(tasks.map((t) => [t.id, 'pending'])),
    assignedTo:   {},                  // robotId -> taskId
    carriedBy:    {},                  // taskId  -> robotId
    activeCount:  0,
    pendingCount: tasks.length,
    doneCount:    0,
  }
}

function tick(robots, tasks, st, setSnapshot) {
  if (!st.initialised) return

  // ── 1. Update reservations + carry status per assigned robot ────────────
  // A robot reserves *only the leg it's currently driving on* — not the full
  // pickup→dropoff trip — so a robot waiting at the pickup point doesn't
  // block lanes it hasn't entered yet.
  for (const r of robots) {
    const animState = r.store.getState().animState
    const taskId    = st.assignedTo.get(r.id)
    if (!taskId) continue
    const task = tasks.find((t) => t.id === taskId)
    if (!task) continue

    if (animState === 'idle') {
      // Task done — clear everything.
      st.assignedTo.delete(r.id)
      st.reservations.delete(r.id)
      st.carriedBy.delete(taskId)
      st.taskStatus.set(taskId, 'done')
      continue
    }

    // Active leg: pick the current driving segment.
    const platform = r.store.getState().platformPose?.position
    const cur      = platform ? [platform[0], platform[2]] : task.from
    if (animState === 'moving_to_start') {
      st.reservations.set(r.id, { from: cur, to: task.from })
    } else if (animState === 'moving_to_end') {
      st.reservations.set(r.id, { from: cur, to: task.to })
    } else if (animState === 'returning') {
      const home = r.store.getState().platformHome?.position
      const homeXZ = home ? [home[0], home[2]] : r.dock
      st.reservations.set(r.id, { from: cur, to: homeXZ })
    } else {
      // grabbing / releasing — stationary, very short reservation
      st.reservations.set(r.id, { from: cur, to: cur })
    }

    // Carrying status — the box rides the gripper between grab and release.
    if (animState === 'moving_to_end' || animState === 'releasing') {
      st.carriedBy.set(taskId, r.id)
    } else {
      st.carriedBy.set(taskId, null)
    }
  }

  // ── 2. Assign tasks to idle robots, respecting reservations ─────────────
  const idleRobots = robots
    .filter((r) => !st.assignedTo.has(r.id) && r.store.getState().animState === 'idle')
    .map((r) => ({ id: r.id, position: getPlatformXZ(r) }))

  const pendingTasks = tasks
    .filter((t) => st.taskStatus.get(t.id) === 'pending')
    .map((t) => ({ id: t.id, from: t.from }))

  const proposals = assignNearestPending(idleRobots, pendingTasks)
  for (const { robotId, taskId } of proposals) {
    const robot = robots.find((r) => r.id === robotId)
    const task  = tasks.find((t)  => t.id === taskId)
    if (!robot || !task) continue

    const reservations = Array.from(st.reservations.values())
    const robotXZ = getPlatformXZ(robot)
    const legToPickup  = pathConflicts(robotXZ,  task.from, reservations, SAFETY_DISTANCE)
    const legToDropoff = pathConflicts(task.from, task.to,   reservations, SAFETY_DISTANCE)
    if (legToPickup || legToDropoff) {
      // Hold this task for a later tick; another conflicting task may finish.
      continue
    }

    // Commit: reserve, mark assigned, kick the robot's state machine.
    // Initial reservation is the drive-to-pickup leg — the per-tick updater
    // will replace it as the robot progresses through grabbing / dropoff / return.
    st.taskStatus.set(taskId, 'assigned')
    st.assignedTo.set(robotId, taskId)
    st.reservations.set(robotId, { from: robotXZ, to: task.from })

    const api = robot.store
    api.getState().setStartObject({
      position:   [task.from[0], task.size[1] / 2, task.from[1]],
      rotation:   [0, 0, 0],
      grabVector: [0, 1, 0],
    })
    api.getState().setEndObject({
      position:   [task.to[0], task.size[1] / 2, task.to[1]],
      rotation:   [0, 0, 0],
      grabVector: [0, 1, 0],
    })
    api.setState({ mobileMode: true })
    api.getState().setAnimState('moving_to_start')
    api.getState().addLog('info', `Task ${task.label}: pickup → dropoff`)
  }

  // ── 3. Publish a snapshot for the UI (only if anything changed) ─────────
  const snap = {
    taskStatus:   Object.fromEntries(st.taskStatus),
    assignedTo:   Object.fromEntries(st.assignedTo),
    carriedBy:    Object.fromEntries(st.carriedBy),
    pendingCount: countWhere(st.taskStatus, 'pending'),
    activeCount:  st.assignedTo.size,
    doneCount:    countWhere(st.taskStatus, 'done'),
  }
  setSnapshot((prev) => snapshotsEqual(prev, snap) ? prev : snap)
}

function getPlatformXZ(robot) {
  const p = robot.store.getState().platformPose?.position
  if (p) return [p[0], p[2]]
  return [robot.dock[0], robot.dock[1]]
}

function countWhere(map, value) {
  let n = 0
  for (const v of map.values()) if (v === value) n++
  return n
}

function snapshotsEqual(a, b) {
  if (!a || !b) return false
  if (a.pendingCount !== b.pendingCount) return false
  if (a.activeCount  !== b.activeCount)  return false
  if (a.doneCount    !== b.doneCount)    return false
  // Compare maps shallowly (same keys + same values).
  for (const k of Object.keys(b.taskStatus)) if (a.taskStatus[k] !== b.taskStatus[k]) return false
  for (const k of Object.keys(b.assignedTo)) if (a.assignedTo[k] !== b.assignedTo[k]) return false
  for (const k of Object.keys(b.carriedBy))  if (a.carriedBy[k]  !== b.carriedBy[k])  return false
  if (Object.keys(a.assignedTo).length !== Object.keys(b.assignedTo).length) return false
  if (Object.keys(a.carriedBy).length  !== Object.keys(b.carriedBy).length)  return false
  return true
}
