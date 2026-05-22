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
 *   4. each frame, drives the box mesh's transform based on the robot's
 *      animState — the same scheme the main demo's <CarriedObject> uses:
 *        moving_to_start / grabbing → sit at the pickup pose
 *        moving_to_end              → position from gripper pinch frame,
 *                                     rotation slerped startQuat → endQuat
 *                                     using easeInOutCubic(animProgress)
 *        releasing / returning      → sit at the drop pose
 *
 *      Using slerped rotation (instead of rigidly parenting under the wrist)
 *      avoids the one-frame snap at release that comes from CCD-IK leaving
 *      spin about the tool axis (joint_6) unconstrained.
 *
 * The lib's AnimationController owns the *kinematics*; this file owns the
 * *who does what, and when*.  Nothing here touches IK or joint angles.
 */
import * as THREE from 'three'
import { easeInOutCubic } from 'robo-playground'

function dist2(a, b) {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return dx * dx + dz * dz
}

const _toolPos  = new THREE.Vector3()
const _toolQuat = new THREE.Quaternion()
const _outPos   = new THREE.Vector3()
const _outQuat  = new THREE.Quaternion()
const _tmpV     = new THREE.Vector3()

function getToolLink(robot) {
  return robot?.links?.tool0 || robot?.links?.flange || robot?.links?.link_6 || null
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
    currentWorld:  [...b.from],
    startRotation: [...(b.fromRotation || [0, 0, 0])],
    endRotation:   [...(b.toRotation   || [0, 0, 0])],
    priority:      b.priority ?? 0,
    // Filled in on entry to moving_to_end (see driveCarriedMesh below).
    carry: null, // { localPos: Vector3, startQuat: Quaternion, endQuat: Quaternion }
  }))

  // per-robot bookkeeping — which task they're currently doing.
  const robotBusy = new Map()      // robotId -> task
  const robotPrevState = new Map() // robotId -> previous animState string

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
      t.currentWorld  = [...t.box.from]
      t.startRotation = [...(t.box.fromRotation || [0, 0, 0])]
      t.endRotation   = [...(t.box.toRotation   || [0, 0, 0])]
      t.carry = null
      const mesh = t.box.meshRef?.current
      if (mesh) {
        mesh.position.set(t.box.from[0], t.box.from[1], t.box.from[2])
        const r = t.startRotation
        mesh.rotation.set(r[0], r[1], r[2])
        mesh.updateMatrixWorld(true)
      }
    }
    robotBusy.clear()
    robotPrevState.clear()
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
      // Skip robots whose URDF hasn't finished loading yet — otherwise the
      // AnimationController has no robotRef and silently burns through the
      // pick-and-place state machine without animating.
      if (!r.store.getState().robotLoaded) continue
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
    // Only consider the lowest-priority tier that still has pending tasks.
    // This enforces build dependencies (walls before roof, roof before chimney)
    // without forcing strictly serial execution within a tier.
    let minPriority = Infinity
    for (const t of tasks) {
      if (t.state === 'pending' && t.priority < minPriority) minPriority = t.priority
    }
    if (minPriority === Infinity) return null

    // Within the active tier, the robot still grabs whichever pending box is
    // nearest its current platform position.
    const platPos = robot.store.getState().platformPose.position
    let best = null, bestD = Infinity
    for (const t of tasks) {
      if (t.state !== 'pending') continue
      if (t.priority !== minPriority) continue
      const d = dist2(platPos, t.currentWorld)
      if (d < bestD) { bestD = d; best = t }
    }
    return best
  }

  function assign(robot, task) {
    task.state = 'assigned'
    task.assignedTo = robot.id
    task.carry = null
    robotBusy.set(robot.id, task)
    const box = task.box

    robot.store.setState({
      startObject: {
        position: [...task.currentWorld],
        rotation: [...task.startRotation],
        grabVector: box.grab || [0, 1, 0],
      },
      endObject: {
        position: [...box.to],
        rotation: [...task.endRotation],
        grabVector: box.grab || [0, 1, 0],
      },
      animState: 'moving_to_start',
    })
    log('info', `Robot ${robot.id} → box ${box.id}`)
  }

  /* Per-frame transform update for the carried box — mirrors the
   * <CarriedObject> logic from the main demo. */
  function driveCarriedMesh(robot, task, state, prev) {
    const mesh = task.box.meshRef?.current
    if (!mesh) return
    const st = state.animState

    if (st === 'moving_to_start' || st === 'grabbing') {
      const [x, y, z] = task.currentWorld
      mesh.position.set(x, y, z)
      mesh.rotation.set(task.startRotation[0], task.startRotation[1], task.startRotation[2])
      return
    }

    if (st === 'moving_to_end') {
      const tool = getToolLink(state.robotRef)
      if (!tool) return

      // On entry: cache the cube-centre offset in tool-local space, and
      // both endpoint orientations as quaternions.
      if (prev !== 'moving_to_end' || !task.carry) {
        tool.updateWorldMatrix(true, false)
        tool.getWorldPosition(_toolPos)
        tool.getWorldQuaternion(_toolQuat)

        const cubeWorld = new THREE.Vector3(...task.currentWorld)
        const invTool   = _toolQuat.clone().invert()
        const localPos  = cubeWorld.clone().sub(_toolPos).applyQuaternion(invTool)

        const startQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(task.startRotation[0], task.startRotation[1], task.startRotation[2], 'XYZ')
        )
        const endQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(task.endRotation[0], task.endRotation[1], task.endRotation[2], 'XYZ')
        )
        task.carry = { localPos, startQuat, endQuat }
      }

      tool.updateWorldMatrix(true, false)
      tool.getWorldPosition(_toolPos)
      tool.getWorldQuaternion(_toolQuat)

      _outPos.copy(task.carry.localPos).applyQuaternion(_toolQuat).add(_toolPos)

      // animProgress is stale on the entry frame (still 1 from the previous
      // segment).  Force t=0 there to avoid a one-frame flip to end orientation.
      const rawT = prev !== 'moving_to_end' ? 0 : Math.max(0, Math.min(1, state.animProgress || 0))
      const t    = easeInOutCubic(rawT)
      _outQuat.copy(task.carry.startQuat).slerp(task.carry.endQuat, t)

      mesh.position.copy(_outPos)
      mesh.quaternion.copy(_outQuat)
      return
    }

    // releasing | returning → park at end pose
    const [tx, ty, tz] = task.box.to
    mesh.position.set(tx, ty, tz)
    mesh.rotation.set(task.endRotation[0], task.endRotation[1], task.endRotation[2])
  }

  /* Called each frame from a React useFrame to drive the per-robot box
   * transforms and observe state transitions. */
  function tick() {
    if (!running) return

    for (const r of robots) {
      const state = r.store.getState()
      const st    = state.animState
      const prev  = robotPrevState.get(r.id) ?? 'idle'

      const task = robotBusy.get(r.id)
      if (task) driveCarriedMesh(r, task, state, prev)

      if (st !== prev) {
        robotPrevState.set(r.id, st)

        if (task) {
          if (st === 'releasing') {
            // The carry is complete — update the task's current world pose
            // so future re-assignments (e.g. re-stacking) start from here.
            task.currentWorld  = [...task.box.to]
            task.startRotation = [...task.endRotation]
            task.carry = null
          }
          // On entering 'returning', try to short-circuit straight to the
          // next pickup instead of driving home.  We assign() right here so
          // that other robots transitioning to 'returning' in this same tick
          // see the task as 'assigned' and don't all try to claim it.  If no
          // task is available, leave animState='returning' so the
          // AnimationController finishes driving this robot home.
          if (st === 'returning') {
            task.state = 'done'
            log('ok', `Robot ${r.id} done with box ${task.box.id}`)
            robotBusy.delete(r.id)

            const next = pickTask(r)
            if (next) {
              assign(r, next)
              robotPrevState.set(r.id, 'moving_to_start')
            }
            continue
          }
          if (st === 'idle') {
            if (task.state === 'assigned') {
              task.state = 'done'
              log('ok', `Robot ${r.id} done with box ${task.box.id}`)
            }
            robotBusy.delete(r.id)
          }
        }
      }
    }

    // Always re-pump so newly-loaded robots get work without us having to
    // wait for one of the active robots to finish a segment.
    if (running) pump()
  }

  return {
    start,
    reset,
    tick,
    isRunning: () => running,
    tasks,                   // exposed for the UI
  }
}
