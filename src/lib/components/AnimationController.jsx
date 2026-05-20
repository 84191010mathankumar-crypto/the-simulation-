import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useRobotStoreApi } from '../state/store.jsx'
import { JOINT_NAMES, HOME_ANGLES } from '../state/constants.js'
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

const HOME_PLATFORM = { position: [0, 0, 0], rotation: [0, 0, 0] }

// Distance from the platform's base centre to the target object — chosen so
// the arm can reach the target naturally without being either cramped or
// fully extended.
const PLATFORM_STANDOFF = 1.1

/* Park the platform STANDOFF metres back from the target along the line
 * from world origin → target.  Platform rotation stays at zero — the arm's
 * joint_1 will swing to face the target via IK. */
function computePlatformPoseFor(targetWorldPos) {
  const tx = targetWorldPos[0]
  const tz = targetWorldPos[2]
  const dist = Math.hypot(tx, tz) || 1e-6
  const px = tx - (tx / dist) * PLATFORM_STANDOFF
  const pz = tz - (tz / dist) * PLATFORM_STANDOFF
  return { position: [px, 0, pz], rotation: [0, 0, 0] }
}

function lerpPose(a, b, t) {
  return {
    position: [
      a.position[0] + (b.position[0] - a.position[0]) * t,
      a.position[1] + (b.position[1] - a.position[1]) * t,
      a.position[2] + (b.position[2] - a.position[2]) * t,
    ],
    rotation: [
      a.rotation[0] + (b.rotation[0] - a.rotation[0]) * t,
      a.rotation[1] + (b.rotation[1] - a.rotation[1]) * t,
      a.rotation[2] + (b.rotation[2] - a.rotation[2]) * t,
    ],
  }
}

/**
 * Headless R3F component — drives the joint animation, and (in mobile mode)
 * the AGV platform pose as well.  Pick-and-place sequence:
 *   moving_to_start → grabbing → moving_to_end → releasing → returning → idle
 */
export default function AnimationController() {
  const progressRef = useRef(0)
  const prevStateRef = useRef('idle')
  const lastFollowKeyRef = useRef('')
  const storeApi = useRobotStoreApi()

  useFrame((_, delta) => {
    const state = storeApi.getState()
    const {
      animState, robotRef, fromAngles, toAngles, fromPlatform, toPlatform,
      followTarget, startObject, endObject, mobileMode,
    } = state

    // ── Follow mode: live IK as the user drags the target ──────────────────
    if (animState === 'idle' && followTarget && robotRef) {
      const obj = followTarget === 'start' ? startObject : endObject
      const key = `${obj.position.join(',')}|${obj.rotation.join(',')}|${obj.grabVector.join(',')}|${mobileMode}`
      if (key !== lastFollowKeyRef.current) {
        lastFollowKeyRef.current = key

        // In mobile mode the platform also follows: snap it to its preferred
        // parked pose for this target before solving IK.
        if (mobileMode) {
          const platPose = computePlatformPoseFor(obj.position)
          storeApi.setState({ platformPose: platPose })
          _setGroupPose(state.platformGroupRef, platPose)
        }

        const { faceCenter, toolZ } = computeGrabPose(obj.position, obj.rotation, obj.grabVector)
        const solved = solveCCDIK(robotRef, faceCenter, toolZ, 80, 0.006)
        if (solved) {
          applyAnglesToRobot(robotRef, solved)
          storeApi.setState({ jointAngles: { ...solved } })
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

      const currentAngles   = readAnglesFromRobot(robotRef) || { ...HOME_ANGLES }
      const currentPlatform = { ...state.platformPose }

      if (animState === 'moving_to_start') {
        _solveSegment(storeApi, state, 'start', currentAngles, currentPlatform)
      } else if (animState === 'moving_to_end') {
        _solveSegment(storeApi, state, 'end',   currentAngles, currentPlatform)
      } else if (animState === 'returning') {
        const homeAngles = clampAllJoints({ ...HOME_ANGLES })
        storeApi.setState({
          fromAngles: currentAngles, toAngles: homeAngles,
          fromPlatform: currentPlatform, toPlatform: { ...HOME_PLATFORM },
        })
        state.addLog('info', 'Returning to HOME…')
      } else {
        // grabbing / releasing: hold pose
        storeApi.setState({
          fromAngles: currentAngles, toAngles: currentAngles,
          fromPlatform: currentPlatform, toPlatform: currentPlatform,
        })
      }
      return
    }

    // ── Advance segment ────────────────────────────────────────────────────
    const duration = SPEED[animState] || 1.0
    progressRef.current = Math.min(1, progressRef.current + delta / duration)
    const t = easeInOutCubic(progressRef.current)

    storeApi.setState({ animProgress: progressRef.current })

    if (fromAngles && toAngles && robotRef) {
      const interp = lerpAngles(fromAngles, toAngles, t)
      applyAnglesToRobot(robotRef, interp)
      storeApi.setState({ jointAngles: { ...interp } })
    }
    if (mobileMode && fromPlatform && toPlatform) {
      const ip = lerpPose(fromPlatform, toPlatform, t)
      storeApi.setState({ platformPose: ip })
    }

    if (progressRef.current >= 1) {
      _onSegmentComplete(storeApi, state, animState)
    }
  })

  return null
}

/* Solve IK for the given target.  If mobile mode is on, we temporarily move
 * the platform group to its computed parked pose so the IK sees the same
 * world frame that the arm will reach into at the end of the segment.  We
 * then restore the group's current pose (the lerp will drive both to the
 * future pose together).
 */
function _solveSegment(storeApi, state, target, currentAngles, currentPlatform) {
  const { robotRef, startObject, endObject, addLog, mobileMode, platformGroupRef } = state
  if (!robotRef) return

  const obj = target === 'start' ? startObject : endObject
  const { faceCenter, toolZ } = computeGrabPose(obj.position, obj.rotation, obj.grabVector)

  // Pick where the platform should park for this target
  const targetPlatform = mobileMode ? computePlatformPoseFor(obj.position) : currentPlatform

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

  // Restore group to its current pose (the lerp will drive it from here)
  if (mobileMode && group && savedPos && savedRot) {
    group.position.copy(savedPos)
    group.rotation.copy(savedRot)
    group.updateMatrixWorld(true)
  }

  if (solved) {
    const clamped = clampAllJoints(solved)
    applyAnglesToRobot(robotRef, currentAngles)
    addLog('ok', `IK converged for ${target.toUpperCase()}`, _logAngles(clamped))
    storeApi.setState({
      fromAngles: currentAngles, toAngles: clamped,
      fromPlatform: currentPlatform, toPlatform: targetPlatform,
    })
  } else {
    addLog('warn', `IK did not converge for ${target} — target may be out of reach`)
    applyAnglesToRobot(robotRef, currentAngles)
    storeApi.setState({
      fromAngles: currentAngles, toAngles: currentAngles,
      fromPlatform: currentPlatform, toPlatform: currentPlatform,
    })
  }
}

/* Directly poke a THREE.Group's transform.  Used during IK solves so the
 * group reflects the hypothetical platform pose without going through a
 * React render cycle.  Also called from follow mode for instant snapping. */
function _setGroupPose(group, pose) {
  if (!group) return
  group.position.set(pose.position[0], pose.position[1], pose.position[2])
  group.rotation.set(pose.rotation[0], pose.rotation[1], pose.rotation[2])
  group.updateMatrixWorld(true)
}

function _onSegmentComplete(storeApi, state, current) {
  const { addLog, setAnimState, robotRef } = state
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
      storeApi.setState({ animProgress: 0 })
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
