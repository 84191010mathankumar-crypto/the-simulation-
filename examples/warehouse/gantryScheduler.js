/**
 * Warehouse task scheduler — gantry variant.
 *
 * Same shape as ./scheduler.js (arm fleet), but drives a SINGLE overhead
 * gantry robot whose pose *is* the tool-tip position (no IK).  The gantry
 * is the lib's singleton useGantryStore; its <GantryAnimationController>
 * owns the pick-and-place state machine.  This file only decides what the
 * gantry does next and, each frame, parks each carried box at the right
 * world pose for the current animState.
 *
 * One gantry can only hold one box at a time, so tasks run strictly
 * sequentially — but they still respect build priority tiers so a roof is
 * never attempted before its walls.
 *
 * Limitation: the gantry can only rotate about the vertical (Y) axis, so a
 * box's full XYZ pickup/drop rotation is collapsed to its Y component.
 */
import { useGantryStore } from 'robo-playground'

function dist2(a, b) {
  const dx = a[0] - b[0]
  const dz = a[2] - b[2]
  return dx * dx + dz * dz
}

// Pull the yaw (rotation about Y) out of an [rx, ry, rz] tuple.  The gantry
// physically cannot do X/Z rotations, so we drop them.
function yawOf(rot) {
  return (rot && rot.length >= 2) ? rot[1] : 0
}

export function createGantryScheduler({ boxes, onLog }) {
  const log = onLog || (() => {})
  const store = useGantryStore

  const tasks = boxes.map((b) => ({
    box: b,
    state: 'pending',                 // 'pending' | 'assigned' | 'done'
    currentWorld:  [...b.from],
    startRotY:     yawOf(b.fromRotation),
    endRotY:       yawOf(b.toRotation),
    priority:      b.priority ?? 0,
  }))

  let running = false
  let current = null                  // the task the gantry is working on
  let prevState = 'idle'

  function start() {
    if (running) return
    running = true
    log('info', `Gantry scheduler started — ${tasks.length} task(s)`)
    pump()
  }

  function reset() {
    running = false
    current = null
    prevState = 'idle'
    for (const t of tasks) {
      t.state = 'pending'
      t.currentWorld = [...t.box.from]
      t.startRotY = yawOf(t.box.fromRotation)
      t.endRotY   = yawOf(t.box.toRotation)
      const mesh = t.box.meshRef?.current
      if (mesh) {
        mesh.position.set(t.box.from[0], t.box.from[1], t.box.from[2])
        mesh.rotation.set(
          (t.box.fromRotation || [0,0,0])[0],
          (t.box.fromRotation || [0,0,0])[1],
          (t.box.fromRotation || [0,0,0])[2],
        )
        mesh.updateMatrixWorld(true)
      }
    }
    store.getState().resetToHome()
  }

  /* Pick the next task: lowest priority tier first, then nearest to the
   * gantry's current XY position. */
  function pickTask() {
    let minPriority = Infinity
    for (const t of tasks) {
      if (t.state === 'pending' && t.priority < minPriority) minPriority = t.priority
    }
    if (minPriority === Infinity) return null

    const pose = store.getState().pose
    const here = [pose.x, 0, pose.z]
    let best = null, bestD = Infinity
    for (const t of tasks) {
      if (t.state !== 'pending') continue
      if (t.priority !== minPriority) continue
      const d = dist2(here, t.currentWorld)
      if (d < bestD) { bestD = d; best = t }
    }
    return best
  }

  function assign(task) {
    task.state = 'assigned'
    current = task
    store.setState({
      startObject: {
        position: [...task.currentWorld],
        rotY: task.startRotY,
      },
      endObject: {
        position: [...task.box.to],
        rotY: task.endRotY,
      },
      animState: 'moving_to_start',
    })
    log('info', `Gantry → box ${task.box.id}`)
  }

  function pump() {
    if (!running) return
    if (current) return
    const next = pickTask()
    if (next) {
      assign(next)
      prevState = 'moving_to_start'
      return
    }
    if (tasks.every((t) => t.state === 'done')) {
      running = false
      log('ok', 'All tasks complete')
    }
  }

  /* Park the carried box at the right pose for the gantry's current state.
   * Mirrors the logic in <GantryCarriedObject> but for arbitrary boxes. */
  function driveCarriedMesh(state) {
    if (!current) return
    const mesh = current.box.meshRef?.current
    if (!mesh) return

    const st = state.animState
    const { pose, carrying } = state

    if (carrying) {
      // Gripper has the box — follow the tool tip directly.
      mesh.position.set(pose.x, pose.y, pose.z)
      mesh.rotation.set(0, pose.rotY, 0)
      return
    }

    // Not yet grabbed → sit at the pickup pose.
    // Already released → sit at the drop pose.
    const beforePick = st === 'moving_to_start' || st === 'descending_pick'
    if (beforePick) {
      const [x, y, z] = current.currentWorld
      mesh.position.set(x, y, z)
      mesh.rotation.set(0, current.startRotY, 0)
      return
    }

    const [tx, ty, tz] = current.box.to
    mesh.position.set(tx, ty, tz)
    mesh.rotation.set(0, current.endRotY, 0)
  }

  function tick() {
    if (!running) return
    const state = store.getState()
    const st = state.animState

    driveCarriedMesh(state)

    if (st !== prevState) {
      prevState = st

      // 'releasing' fires once per cycle — the box has just been set down,
      // so the task is effectively complete.  Remember its final pose in
      // case a future re-stack starts from here.
      if (st === 'releasing' && current) {
        current.currentWorld = [...current.box.to]
        current.startRotY = current.endRotY
      }

      // On entering 'returning', the gantry is empty and free for the next
      // task.  Assign immediately so it short-circuits the drive home —
      // same trick the arm scheduler uses.
      if (st === 'returning') {
        if (current) {
          current.state = 'done'
          log('ok', `Gantry done with box ${current.box.id}`)
          current = null
        }
        const next = pickTask()
        if (next) {
          assign(next)
          prevState = 'moving_to_start'
        }
      }
    }

    if (running) pump()
  }

  return {
    start,
    reset,
    tick,
    isRunning: () => running,
    tasks,
  }
}
