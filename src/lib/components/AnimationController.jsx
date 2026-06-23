import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { JOINT_NAMES, HOME_ANGLES } from '../state/useStore'
import { useRobotStore } from '../state/context'
import {
  applyAnglesToRobot,
  readAnglesFromRobot,
  computeGrabPose,
  solveCCDIK,
  lerpAngles,
  easeInOutCubic,
  clampAllJoints,
} from '../ik/ikSolver'

// Seconds per motion segment
const SPEED = {
  moving_to_start: 2.0,
  grabbing:        0.5,
  moving_to_end:   2.0,
  releasing:       0.5,
  returning:       1.6,
}

const SEQUENCE = {
  moving_to_start: 'grabbing',
  grabbing:        'moving_to_end',
  moving_to_end:   'releasing',
  releasing:       'returning',
  returning:       'idle',
}

// Distance from the platform's base centre to the target object — chosen so
// the arm can reach the target naturally without being either cramped or
// fully extended.
const PLATFORM_STANDOFF = 1.1

/* Pick where the platform should park to grab the target.
 *
 *   parkingRef = 'origin' (default, main demo) — park STANDOFF metres before
 *                the target along the line from WORLD ORIGIN to the target.
 *   parkingRef = 'self'   (warehouse)         — park STANDOFF metres before
 *                the target along the line from the robot's CURRENT platform
 *                position to the target.  This way each roaming robot
 *                approaches from the side it's already on.
 */
function computePlatformPoseFor(targetWorldPos, currentPlatformPos, parkingRef) {
  const tx = targetWorldPos[0]
  const tz = targetWorldPos[2]
  const refX = parkingRef === 'self' ? currentPlatformPos[0] : 0
  const refZ = parkingRef === 'self' ? currentPlatformPos[2] : 0
  const dx = tx - refX
  const dz = tz - refZ
  const dist = Math.hypot(dx, dz) || 1e-6
  const px = tx - (dx / dist) * PLATFORM_STANDOFF
  const pz = tz - (dz / dist) * PLATFORM_STANDOFF
  return { position: [px, 0, pz], rotation: [0, 0, 0] }
}

// Half the AGV's footprint plus a little buffer — restricted zones are
// expanded by this much before we test against them, so the platform body
// (not just its centre point) stays clear of them.
const AGV_CLEARANCE = 0.65

/* Does the segment p0→p1 (2D, [x,z]) cross the zone's rectangle, expanded
 * by `margin` on every side?  Standard slab/AABB segment test. */
function segmentHitsZone(p0, p1, zone, margin) {
  const lo = [zone.minX - margin, zone.minZ - margin]
  const hi = [zone.maxX + margin, zone.maxZ + margin]
  const d = [p1[0] - p0[0], p1[1] - p0[1]]
  let tmin = 0, tmax = 1
  for (let axis = 0; axis < 2; axis++) {
    const o = p0[axis]
    if (Math.abs(d[axis]) < 1e-9) {
      if (o < lo[axis] || o > hi[axis]) return false
    } else {
      let t0 = (lo[axis] - o) / d[axis]
      let t1 = (hi[axis] - o) / d[axis]
      if (t0 > t1) { const tmp = t0; t0 = t1; t1 = tmp }
      tmin = Math.max(tmin, t0)
      tmax = Math.min(tmax, t1)
      if (tmin > tmax) return false
    }
  }
  return true
}

function findBlockingZone(p0, p1, zones) {
  for (const z of zones) {
    if (segmentHitsZone(p0, p1, z, AGV_CLEARANCE)) return z
  }
  return null
}

/* Builds the list of waypoints (world positions) the platform should drive
 * through to get from `fromPos` to `toPos` without entering a restricted
 * zone.  Straight line if nothing's in the way; otherwise routes around the
 * nearest corner of the first zone it hits.  This is a simple one-bounce
 * router, not full pathfinding — plenty for a handful of user-drawn zones. */
function buildAvoidancePath(fromPos, toPos, zones) {
  if (!zones || zones.length === 0) return [fromPos, toPos]

  const p0 = [fromPos[0], fromPos[2]]
  const p1 = [toPos[0], toPos[2]]
  const blocker = findBlockingZone(p0, p1, zones)
  if (!blocker) return [fromPos, toPos]

  const m = AGV_CLEARANCE
  const candidates = [
    [blocker.minX - m, blocker.minZ - m],
    [blocker.minX - m, blocker.maxZ + m],
    [blocker.maxX + m, blocker.minZ - m],
    [blocker.maxX + m, blocker.maxZ + m],
  ]

  const cost = (c) => Math.hypot(c[0] - p0[0], c[1] - p0[1]) + Math.hypot(p1[0] - c[0], p1[1] - c[1])

  let best = null, bestCost = Infinity
  for (const c of candidates) {
    if (findBlockingZone(p0, c, zones) || findBlockingZone(c, p1, zones)) continue
    const cst = cost(c)
    if (cst < bestCost) { bestCost = cst; best = c }
  }
  // Nothing fully clear (e.g. zones overlap) — still detour via the cheapest
  // corner rather than driving straight through the obstacle.
  if (!best) {
    for (const c of candidates) {
      const cst = cost(c)
      if (cst < bestCost) { bestCost = cst; best = c }
    }
  }

  return [fromPos, [best[0], fromPos[1], best[1]], toPos]
}

function lerpRotation(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

function legLength(a, b) {
  return Math.hypot(b[0] - a[0], b[2] - a[2])
}

function legPosition(a, b, u) {
  const y = a[1] + (b[1] - a[1]) * u
  return [a[0] + (b[0] - a[0]) * u, y, a[2] + (b[2] - a[2]) * u]
}

// Must match the floor <Grid cellSize> in WarehouseScene so a "grid line"
// here is the same line the player sees drawn on the floor.
const GRID_CELL = 1

function snapToGrid(v) {
  return Math.round(v / GRID_CELL) * GRID_CELL
}

/* Expands a raw path (e.g. from buildAvoidancePath) into one that actually
 * rides along the floor's grid lines instead of just being axis-aligned at
 * arbitrary coordinates.  Each leg a→b becomes: a → nearest grid
 * intersection to a → the intersection that shares b's grid X (still a real
 * intersection, since both coordinates are snapped) → nearest grid
 * intersection to b → b.  The first/last hops off the grid are unavoidable
 * since the AGV parks wherever the target object actually is. */
function gridSnapPath(waypoints) {
  const out = [waypoints[0]]
  const push = (p) => {
    const prev = out[out.length - 1]
    if (Math.hypot(p[0] - prev[0], p[2] - prev[2]) > 1e-4) out.push(p)
  }
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i], b = waypoints[i + 1]
    const y = a[1]
    const aSnap = [snapToGrid(a[0]), y, snapToGrid(a[2])]
    const bSnap = [snapToGrid(b[0]), y, snapToGrid(b[2])]
    const bend  = [bSnap[0], y, aSnap[2]]
    push(aSnap); push(bend); push(bSnap); push(b)
  }
  return out
}

/* Walks a multi-waypoint path (as built by buildAvoidancePath, optionally
 * grid-snapped by gridSnapPath) to the world position/rotation at overall
 * progress `t`. */
function poseAlongPath(path, rotA, rotB, t) {
  const rotation = lerpRotation(rotA, rotB, t)
  if (path.length < 2) return { position: [...path[0]], rotation }

  const legLens = []
  for (let i = 0; i < path.length - 1; i++) legLens.push(legLength(path[i], path[i + 1]))
  const total = legLens.reduce((a, b) => a + b, 0)
  if (total < 1e-6) return { position: [...path[path.length - 1]], rotation }

  let remaining = t * total
  for (let i = 0; i < legLens.length; i++) {
    const len = legLens[i]
    if (remaining <= len || i === legLens.length - 1) {
      const u = len > 1e-6 ? Math.min(1, remaining / len) : 1
      return { position: legPosition(path[i], path[i + 1], u), rotation }
    }
    remaining -= len
  }
  return { position: [...path[path.length - 1]], rotation }
}

/**
 * Headless R3F component — drives the joint animation and (in mobile mode)
 * the AGV platform pose.  Pick-and-place sequence:
 *   moving_to_start → grabbing → moving_to_end → releasing → returning → idle
 *
 * Binds to the per-robot store from `RobotStoreContext`; with no provider it
 * uses the lib singleton, which is exactly the main demo's behaviour.
 */
export default function AnimationController() {
  const progressRef = useRef(0)
  const prevStateRef = useRef('idle')
  const lastFollowKeyRef = useRef('')
  const useStore = useRobotStore()

  useFrame((_, delta) => {
    const store = useStore.getState()
    const {
      animState, robotRef, fromAngles, toAngles, fromPlatform, toPlatform,
      followTarget, startObject, endObject, mobileMode,
      platformPose, parkingRef, platformPath,
    } = store

    // ── Follow mode: live IK as the user drags the target ──────────────────
    if (animState === 'idle' && followTarget && robotRef) {
      const obj = followTarget === 'start' ? startObject : endObject
      const key = `${obj.position.join(',')}|${obj.rotation.join(',')}|${obj.grabVector.join(',')}|${mobileMode}`
      if (key !== lastFollowKeyRef.current) {
        lastFollowKeyRef.current = key

        if (mobileMode) {
          const platPose = computePlatformPoseFor(obj.position, platformPose.position, parkingRef)
          useStore.setState({ platformPose: platPose })
          _setGroupPose(store.platformGroupRef, platPose)
        }

        const { faceCenter, toolZ } = computeGrabPose(obj.position, obj.rotation, obj.grabVector)
        const solved = solveCCDIK(robotRef, faceCenter, toolZ, 80, 0.006)
        if (solved) {
          applyAnglesToRobot(robotRef, solved)
          useStore.setState({ jointAngles: { ...solved } })
        }
      }
      return
    }

    if (animState === 'idle') {
      prevStateRef.current = 'idle'
      progressRef.current  = 0
      lastFollowKeyRef.current = ''
      return
    }

    // ── First frame of a new segment: solve IK + pick platform target ─────
    if (prevStateRef.current !== animState) {
      prevStateRef.current = animState
      progressRef.current  = 0
      // Also publish the reset to the store so other useFrame consumers
      // (e.g. CarriedObject, the warehouse scheduler) don't read the stale
      // animProgress=1 left over from the previous segment on the *next*
      // frame.  Without this, they slerp to the end of their interpolation
      // for one frame.
      useStore.setState({ animProgress: 0 })

      const currentAngles   = readAnglesFromRobot(robotRef) || { ...HOME_ANGLES }
      const currentPlatform = { ...store.platformPose }

      if (animState === 'moving_to_start') {
        _solveSegment(useStore, store, 'start', currentAngles, currentPlatform)
      } else if (animState === 'moving_to_end') {
        _solveSegment(useStore, store, 'end',   currentAngles, currentPlatform)
      } else if (animState === 'returning') {
        const homeAngles = clampAllJoints({ ...HOME_ANGLES })
        const homePlatform = { ...store.homePlatform }
        const rawPath = buildAvoidancePath(currentPlatform.position, homePlatform.position, store.zones)
        useStore.setState({
          fromAngles: currentAngles, toAngles: homeAngles,
          fromPlatform: currentPlatform, toPlatform: homePlatform,
          platformPath: store.gridMovement ? gridSnapPath(rawPath) : rawPath,
        })
        store.addLog('info', 'Returning to HOME…')
      } else {
        useStore.setState({
          fromAngles: currentAngles, toAngles: currentAngles,
          fromPlatform: currentPlatform, toPlatform: currentPlatform,
          platformPath: [currentPlatform.position, currentPlatform.position],
        })
      }
      return
    }

    // ── Advance segment ────────────────────────────────────────────────────
    const duration = SPEED[animState] || 1.0
    progressRef.current = Math.min(1, progressRef.current + delta / duration)
    const t = easeInOutCubic(progressRef.current)

    useStore.setState({ animProgress: progressRef.current })

    if (fromAngles && toAngles && robotRef) {
      const interp = lerpAngles(fromAngles, toAngles, t)
      applyAnglesToRobot(robotRef, interp)
      useStore.setState({ jointAngles: { ...interp } })
    }
    if (mobileMode && fromPlatform && toPlatform) {
      const path = platformPath && platformPath.length >= 2
        ? platformPath
        : [fromPlatform.position, toPlatform.position]
      const ip = poseAlongPath(path, fromPlatform.rotation, toPlatform.rotation, t)
      useStore.setState({ platformPose: ip })
    }

    if (progressRef.current >= 1) {
      _onSegmentComplete(useStore, store, animState)
    }
  })

  return null
}

function _solveSegment(useStore, store, target, currentAngles, currentPlatform) {
  const { robotRef, startObject, endObject, addLog, mobileMode, platformGroupRef, parkingRef } = store
  if (!robotRef) return

  const obj = target === 'start' ? startObject : endObject
  const { faceCenter, toolZ } = computeGrabPose(obj.position, obj.rotation, obj.grabVector)

  const targetPlatform = mobileMode
    ? computePlatformPoseFor(obj.position, currentPlatform.position, parkingRef)
    : currentPlatform

  addLog('info', `IK: solving for ${target.toUpperCase()}`, {
    X: faceCenter.x.toFixed(3),
    Y: faceCenter.y.toFixed(3),
    Z: faceCenter.z.toFixed(3),
  })

  // Snap platform group into its future pose for the duration of the solve
  const group = platformGroupRef
  let savedPos = null, savedRot = null
  if (mobileMode && group) {
    savedPos = group.position.clone()
    savedRot = group.rotation.clone()
    _setGroupPose(group, targetPlatform)
  }

  const solved = solveCCDIK(robotRef, faceCenter, toolZ, 160, 0.005)

  if (mobileMode && group && savedPos && savedRot) {
    group.position.copy(savedPos)
    group.rotation.copy(savedRot)
    group.updateMatrixWorld(true)
  }

  if (solved) {
    const clamped = clampAllJoints(solved)
    applyAnglesToRobot(robotRef, currentAngles)
    addLog('ok', `IK converged for ${target.toUpperCase()}`, _logAngles(clamped))
    const rawPath = buildAvoidancePath(currentPlatform.position, targetPlatform.position, store.zones)
    useStore.setState({
      fromAngles: currentAngles, toAngles: clamped,
      fromPlatform: currentPlatform, toPlatform: targetPlatform,
      platformPath: store.gridMovement ? gridSnapPath(rawPath) : rawPath,
    })
  } else {
    addLog('warn', `IK did not converge for ${target} — target may be out of reach`)
    applyAnglesToRobot(robotRef, currentAngles)
    useStore.setState({
      fromAngles: currentAngles, toAngles: currentAngles,
      fromPlatform: currentPlatform, toPlatform: currentPlatform,
      platformPath: [currentPlatform.position, currentPlatform.position],
    })
  }
}

function _setGroupPose(group, pose) {
  if (!group) return
  group.position.set(pose.position[0], pose.position[1], pose.position[2])
  group.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2])
  group.updateMatrixWorld(true)
}

function _onSegmentComplete(useStore, store, current) {
  const { addLog, setAnimState, robotRef } = store
  const currentAngles = robotRef
    ? Object.fromEntries(JOINT_NAMES.map((n) => [n, robotRef.joints[n]?.angle ?? 0]))
    : {}

  switch (current) {
    case 'moving_to_start':
      addLog('ok', '✓ Reached START — executing grab', _logAngles(currentAngles))
      break
    case 'grabbing':
      addLog('info', '✓ Object grabbed')
      break
    case 'moving_to_end':
      addLog('ok', '✓ Reached END — releasing', _logAngles(currentAngles))
      break
    case 'releasing':
      addLog('info', '✓ Object released')
      break
    case 'returning':
      addLog('ok', '✓ HOME — sequence complete', _logAngles(HOME_ANGLES))
      useStore.setState({ animProgress: 0 })
      break
  }

  const next = SEQUENCE[current] || 'idle'
  setAnimState(next)
}

function _logAngles(angles) {
  const out = {}
  for (const n of JOINT_NAMES) {
    out[n.replace('joint_', 'A')] = angles[n] ?? 0
  }
  return out
}
