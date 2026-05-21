/**
 * Warehouse task scheduler.
 *
 * Decoupled from React.  Given:
 *   - a list of robot stores (per-instance zustand stores from `createRobotStore`)
 *   - a queue of tasks (one per box: move box.from → box.to with a grab vector)
 *
 * runs a small loop that:
 *   1. picks the nearest available task for each idle robot,
 *   2. writes start/end into that robot's store,
 *   3. flips animState to 'moving_to_start' (triggers the existing
 *      AnimationController to execute the exact same arm motion as the
 *      main demo),
 *   4. watches the per-robot animState to drive box parenting:
 *        - on 'grabbing'   → parent box mesh under the robot's gripper
 *        - on 'releasing'  → unparent + snap box to its target.
 *
 * The lib's AnimationController owns the *kinematics*; this file owns the
 * *who does what, and when*.  Nothing here touches IK or joint angles.
 */
import * as THREE from 'three'

const TMP_V = new THREE.Vector3()
const TMP_Q = new THREE.Quaternion()
const TMP_S = new THREE.Vector3()

function dist2(a, b) {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return dx * dx + dz * dz
}

/**
 * Create a scheduler instance.
 *
 *   robots: Array<{
 *     id: string,
 *     store: ZustandStoreHook,            // from createRobotStore()
 *     groupRef: { current: THREE.Group }, // robot's outer group in the scene
 *   }>
 *
 *   boxes: Array<{
 *     id, size:[w,h,d], from:[x,y,z], to:[x,y,z], grab:[x,y,z],
 *     meshRef: { current: THREE.Mesh },   // the rendered box in the scene
 *   }>
 *
 *   onLog?: (level, msg) => void
 */
export function createScheduler({ robots, boxes, onLog }) {
  const log = onLog || (() => {})

  // task = one per box, all start pending
  const tasks = boxes.map((b) => ({
    box: b,
    state: 'pending',                 // 'pending' | 'assigned' | 'done'
    assignedTo: null,
    // currentWorld is updated as the box is moved.  Initialised to `from`.
    currentWorld: [...b.from],
  }))

  // per-robot bookkeeping — which task they're currently doing, and a
  // ref to the box mesh we've parented under their gripper.
  const robotBusy = new Map()      // robotId -> task
  const robotPrevState = new Map() // robotId -> previous animState string
  const carriedMesh = new Map()    // robotId -> THREE.Mesh (or null)

  let running = false

  function start() {
    if (running) return
    running = true
    log('info', `Scheduler started — ${tasks.length} task(s), ${robots.length} robot(s)`)
    pump()
  }

  function reset() {
    running = false
    for (const t of tasks) {
      t.state = 'pending'
      t.assignedTo = null
      t.currentWorld = [...t.box.from]
      const mesh = t.box.meshRef?.current
      if (mesh) {
        // Detach if parented, then put back at `from`.
        if (mesh.parent && mesh.parent !== mesh.userData.originalParent) {
          mesh.parent.remove(mesh)
          mesh.userData.originalParent?.add(mesh)
        }
        mesh.position.set(t.box.from[0], t.box.from[1], t.box.from[2])
        mesh.rotation.set(0, 0, 0)
        mesh.updateMatrixWorld(true)
      }
    }
    robotBusy.clear()
    carriedMesh.clear()
    for (const r of robots) {
      r.store.getState().resetToHome()
      r.store.setState({ animState: 'idle', animProgress: 0 })
    }
  }

  /* Try to give every idle robot something to do. */
  function pump() {
    if (!running) return
    for (const r of robots) {
      if (robotBusy.has(r.id)) continue
      const next = pickTask(r)
      if (!next) continue
      assign(r, next)
    }
    // If everything is done and no robots are busy, we're finished.
    if (robotBusy.size === 0 && tasks.every((t) => t.state === 'done')) {
      running = false
      log('ok', 'All tasks complete')
    }
  }

  function pickTask(robot) {
    const platPos = robot.store.getState().platformPose.position
    let best = null, bestD = Infinity
    for (const t of tasks) {
      if (t.state !== 'pending') continue
      const d = dist2(platPos, t.currentWorld)
      if (d < bestD) { bestD = d; best = t }
    }
    return best
  }

  function assign(robot, task) {
    task.state = 'assigned'
    task.assignedTo = robot.id
    robotBusy.set(robot.id, task)
    const box = task.box

    robot.store.setState({
      startObject: {
        position: [...task.currentWorld],
        rotation: [0, 0, 0],
        grabVector: box.grab || [0, 1, 0],
      },
      endObject: {
        position: [...box.to],
        rotation: [0, 0, 0],
        grabVector: box.grab || [0, 1, 0],
      },
      animState: 'moving_to_start',
    })
    log('info', `Robot ${robot.id} → box ${box.id}`)
  }

  /* Called each frame from a React useFrame to observe per-robot animState
   * transitions and drive box parenting accordingly. */
  function tick() {
    if (!running) return
    let anyChanged = false

    for (const r of robots) {
      const st = r.store.getState().animState
      const prev = robotPrevState.get(r.id)
      if (st === prev) continue
      robotPrevState.set(r.id, st)
      anyChanged = true

      const task = robotBusy.get(r.id)
      if (!task) continue
      const box = task.box
      const mesh = box.meshRef?.current
      if (!mesh) continue

      if (st === 'grabbing') {
        // Parent the box under the gripper's tool0 link, preserving its
        // current world transform.
        const robotObj = r.store.getState().robotRef
        const tip = robotObj?.links?.tool0 || robotObj?.links?.flange || robotObj?.links?.link_6
        if (tip) {
          if (!mesh.userData.originalParent) mesh.userData.originalParent = mesh.parent
          mesh.updateMatrixWorld(true)
          tip.updateMatrixWorld(true)
          // worldMatrix(mesh) → local under tip
          const local = tip.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
          local.decompose(TMP_V, TMP_Q, TMP_S)
          mesh.parent?.remove(mesh)
          mesh.position.copy(TMP_V)
          mesh.quaternion.copy(TMP_Q)
          mesh.scale.copy(TMP_S)
          tip.add(mesh)
          carriedMesh.set(r.id, mesh)
        }
      }

      if (st === 'releasing') {
        // Reparent to the original parent and snap to the `to` location.
        const carried = carriedMesh.get(r.id)
        if (carried) {
          carried.parent?.remove(carried)
          ;(carried.userData.originalParent || mesh.userData.originalParent)?.add(carried)
          carried.position.set(box.to[0], box.to[1], box.to[2])
          carried.rotation.set(0, 0, 0)
          carried.updateMatrixWorld(true)
          carriedMesh.delete(r.id)
        }
        task.currentWorld = [...box.to]
      }

      if (st === 'idle') {
        // Task complete (or aborted).  Free the robot and pump for the next.
        if (task.state === 'assigned') {
          task.state = 'done'
          log('ok', `Robot ${r.id} done with box ${box.id}`)
        }
        robotBusy.delete(r.id)
        pump()
      }
    }

    return anyChanged
  }

  return {
    start,
    reset,
    tick,
    isRunning: () => running,
    tasks,                   // exposed for the UI
  }
}
