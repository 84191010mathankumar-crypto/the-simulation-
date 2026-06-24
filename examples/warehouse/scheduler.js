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

// States where the AGV platform is actively moving (vs. stationary arm-only motion).
const MOVING_STATES = new Set(['moving_to_start', 'moving_to_end', 'returning'])

// States where the robot is in the work zone (arm is extended toward workspace).
// 'returning' is excluded — the robot is moving AWAY from the work area.
const DELIVERY_STATES = new Set(['moving_to_start', 'grabbing', 'moving_to_end', 'releasing'])

// Urgency: higher = more important to keep moving (yield to higher-urgency robots).
// 'returning' is HIGHEST — a robot that just placed its box must be allowed to
// clear the work area before any new robot approaches.  Without this, the
// returning robot was paused AT the build site while an incoming robot drove
// straight into it, causing arm-mesh intersection.
function urgencyOf(animState) {
  if (animState === 'returning') return 4           // must leave — never block
  if (animState === 'releasing') return 3           // almost done placing
  if (animState === 'moving_to_end') return 2       // carrying box, yields to above
  if (animState === 'moving_to_start' || animState === 'grabbing') return 1
  return 0
}

// How close two robot centres can get before the lower-priority one yields (metres).
const COLLISION_RADIUS = 2.0

// KR210 maximum arm reach (metres).
const ARM_REACH = 2.7

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
    ownerId: null,                    // set by preAssignTasks() — Voronoi robot territory
    // currentWorld is updated as the box is moved.  Initialised to `from`.
    currentWorld:  [...b.from],
    startRotation: [...(b.fromRotation || [0, 0, 0])],
    endRotation:   [...(b.toRotation   || [0, 0, 0])],
    priority:      b.priority ?? 0,
    // Filled in on entry to moving_to_end (see driveCarriedMesh below).
    carry: null, // { localPos: Vector3, startQuat: Quaternion, endQuat: Quaternion }
  }))

  // Round-robin task assignment: distribute build targets evenly across all
  // robots regardless of home-to-target distances.  Pure nearest-home Voronoi
  // fails when all homes are clustered together (as in the site-planner
  // layout) because every task maps to the same robot.  Round-robin gives
  // each robot ~(total/N) tasks so they can all work in parallel.
  ;(function preAssignTasks() {
    if (robots.length === 0) return
    if (robots.length === 1) { for (const t of tasks) t.ownerId = robots[0].id; return }
    // Sort tasks spatially (by build-target x, then z) for a consistent,
    // spatially-coherent distribution across the robot row.
    const sorted = tasks.slice().sort((a, b) => {
      const dx = a.box.to[0] - b.box.to[0]
      if (Math.abs(dx) > 0.01) return dx
      return a.box.to[2] - b.box.to[2]
    })
    sorted.forEach((t, i) => { t.ownerId = robots[i % robots.length].id })
  })()

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
      r.store.setState({ animState: 'idle', animProgress: 0, paused: false })
    }
  }

  /* Can robot `r` start a delivery cycle right now?
   *
   * Only blocks if another robot's platform is physically overlapping our
   * home position right now (within COLLISION_RADIUS = 2 m).  This prevents
   * two platforms occupying the same grid cell at departure time.
   *
   * All other spatial safety — arm-exclusion zones, path conflicts — is
   * managed in real time by resolveCollisions().  Home-to-home distance is
   * NOT used as a gate; in layouts where all homes are clustered within a
   * few metres of each other, a home-distance gate serialises every robot
   * into a single queue and prevents any parallel work. */
  function canStartSafely(robot) {
    if (!robot.home) return true
    const [rhx, , rhz] = robot.home
    for (const r of robots) {
      if (r.id === robot.id) continue
      const rState = r.store.getState()
      if (rState.animState === 'idle') continue   // folded arm at home — no threat
      const [px, , pz] = rState.platformPose.position
      const dx = rhx - px, dz = rhz - pz
      if (dx * dx + dz * dz < COLLISION_RADIUS * COLLISION_RADIUS) return false
    }
    return true
  }

  /* Activate every idle robot that can safely start without arm-mesh
   * collision.  Robots whose homes are > 5.4 m apart (every 3rd robot in a
   * 2.5 m-spaced row) run in parallel on entirely separate grid paths;
   * closer neighbours queue until the active one exits DELIVERY_STATES. */
  function pump() {
    if (!running) return

    for (const r of robots) {
      if (robotBusy.has(r.id)) continue
      if (!r.store.getState().robotLoaded) continue
      if (!canStartSafely(r)) continue
      const next = pickTask(r)
      if (!next) continue
      assign(r, next)
      // No break — evaluate all robots; multiple can start in the same tick.
    }

    if (robotBusy.size === 0 && tasks.every((t) => t.state === 'done')) {
      running = false
      log('ok', 'All tasks complete')
    }
  }

  function pickTask(robot) {
    // Phase 1: only consider tasks in THIS robot's Voronoi territory.
    // This ensures each arm delivers boxes in its own spatial zone so arms
    // never reach across into a neighbour's zone during the delivery phase.
    let minPriority = Infinity
    for (const t of tasks) {
      if (t.state === 'pending' && t.ownerId === robot.id && t.priority < minPriority)
        minPriority = t.priority
    }

    // Phase 2 (steal): robot finished its own zone — help with whatever remains.
    // This keeps robots busy rather than sitting idle while neighbours finish up.
    let stealing = false
    if (minPriority === Infinity) {
      stealing = true
      for (const t of tasks) {
        if (t.state === 'pending' && t.priority < minPriority) minPriority = t.priority
      }
    }
    if (minPriority === Infinity) return null

    // Within the chosen tier, pick the pending task nearest the robot's current
    // platform position (own zone first, global fallback when stealing).
    const platPos = robot.store.getState().platformPose.position
    let best = null, bestD = Infinity
    for (const t of tasks) {
      if (t.state !== 'pending' || t.priority !== minPriority) continue
      if (!stealing && t.ownerId !== robot.id) continue
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

  // States where the arm is physically extended into the workspace.
  // 'returning' is included because during the early part of the return trip the
  // arm is still sweeping back from its last extended pose — it only fully folds
  // to HOME_ANGLES at progress=1.  Treating it as extended ensures the 5.4 m
  // exclusion zone fires before any incoming robot can enter the now-vacating
  // work area.
  const ARM_EXTENDED = new Set(['grabbing', 'moving_to_end', 'releasing', 'returning'])
  // Safe distance between platforms when either arm is extended (= 2 × reach).
  const SAFE_ARM_SQ = (ARM_REACH * 2) ** 2   // 5.4 m²

  /* Checks all robot pairs and pauses the lower-priority one when they are
   * too close.  Two rules:
   *
   *  ARM EXCLUSION ZONE (5.4 m): whenever either robot's arm is extended
   *   (grabbing / moving_to_end / releasing), the other robot must stay
   *   outside 2 × ARM_REACH.  If it's inside that radius the approaching
   *   robot pauses — platform and arm both freeze — until the extended arm
   *   finishes and moves away.  This prevents mesh intersection even when
   *   two robots converge on the same storage area.
   *
   *  PLATFORM COLLISION (2 m): when both platforms are just travelling
   *   (no arm extended), the narrower radius keeps them from bumping bodies. */
  function resolveCollisions() {
    if (robots.length < 2) return

    const toPause = new Set()
    for (let i = 0; i < robots.length; i++) {
      for (let j = i + 1; j < robots.length; j++) {
        const stA = robots[i].store.getState()
        const stB = robots[j].store.getState()
        const sa  = stA.animState, sb = stB.animState

        const aExt = ARM_EXTENDED.has(sa)
        const bExt = ARM_EXTENDED.has(sb)
        const aMov = MOVING_STATES.has(sa)
        const bMov = MOVING_STATES.has(sb)

        if (!aExt && !bExt && !aMov && !bMov) continue   // both idle — nothing to do

        const posA = stA.platformPose.position
        const posB = stB.platformPose.position
        const dx = posA[0] - posB[0]
        const dz = posA[2] - posB[2]
        const d2 = dx * dx + dz * dz

        if ((aExt || bExt) && d2 < SAFE_ARM_SQ) {
          // Arm-exclusion zone: pause whichever has lower urgency.
          const ua = urgencyOf(sa), ub = urgencyOf(sb)
          if (ua < ub) toPause.add(i)
          else if (ub < ua) toPause.add(j)
          else toPause.add(j)   // tie → pause higher index
        } else if (aMov && bMov && d2 < COLLISION_RADIUS * COLLISION_RADIUS) {
          // Platform-body collision: both moving, pause lower-urgency mover.
          const ua = urgencyOf(sa), ub = urgencyOf(sb)
          if (ua < ub) toPause.add(i)
          else toPause.add(j)
        }
      }
    }

    for (let i = 0; i < robots.length; i++) {
      const shouldPause = toPause.has(i)
      if (robots[i].store.getState().paused !== shouldPause) {
        robots[i].store.setState({ paused: shouldPause })
      }
    }
  }

  /* Called each frame from a React useFrame to drive the per-robot box
   * transforms and observe state transitions. */
  function tick() {
    if (!running) return

    resolveCollisions()

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
          // On entering 'returning': mark task done and free the robot.
          // pump() (called at the end of every tick) will immediately start
          // the next robot's pickup because delivering-count just dropped to 0.
          // The returning robot travels home while the next one heads to storage
          // — opposite directions, no workspace conflict.
          if (st === 'returning') {
            task.state = 'done'
            log('ok', `Robot ${r.id} done with box ${task.box.id}`)
            robotBusy.delete(r.id)
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
