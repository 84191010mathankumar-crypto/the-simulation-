import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import useStore, { JOINT_NAMES, HOME_ANGLES } from '../store/useStore'
import {
  applyAnglesToRobot,
  readAnglesFromRobot,
  computeGrabPose,
  solveCCDIK,
  lerpAngles,
  easeInOutCubic,
  clampAllJoints,
} from '../utils/ikSolver'

// Seconds per motion segment
const SPEED = {
  moving_to_start: 1.8,
  grabbing:        0.5,
  moving_to_end:   1.8,
  releasing:       0.5,
  returning:       1.4,
}

const SEQUENCE = {
  moving_to_start: 'grabbing',
  grabbing:        'moving_to_end',
  moving_to_end:   'releasing',
  releasing:       'returning',
  returning:       'idle',
}

/**
 * Headless R3F component — drives joint animation frame by frame.
 * Pick-and-place sequence:
 *   moving_to_start → grabbing (hold) → moving_to_end → releasing (hold) → returning → idle
 */
export default function AnimationController() {
  const progressRef = useRef(0)
  const prevStateRef = useRef('idle')
  const lastFollowKeyRef = useRef('')

  useFrame((_, delta) => {
    const store = useStore.getState()
    const { animState, robotRef, fromAngles, toAngles,
            followTarget, startObject, endObject } = store

    // ── Follow mode: continuously solve IK for the chosen target ────────────
    // Only active while no sequence is running. Re-solves only when the
    // target's pose actually changes (the user is dragging the gumball).
    if (animState === 'idle' && followTarget && robotRef) {
      const obj = followTarget === 'start' ? startObject : endObject
      const key = `${obj.position.join(',')}|${obj.rotation.join(',')}|${obj.grabVector.join(',')}`
      if (key !== lastFollowKeyRef.current) {
        lastFollowKeyRef.current = key
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

    // ── On first frame of a new state, prepare the segment ──────────────────
    if (prevStateRef.current !== animState) {
      prevStateRef.current = animState
      progressRef.current  = 0

      const currentAngles = readAnglesFromRobot(robotRef) || { ...HOME_ANGLES }

      if (animState === 'moving_to_start') {
        _solveSegment(store, 'start', currentAngles)
      } else if (animState === 'moving_to_end') {
        _solveSegment(store, 'end', currentAngles)
      } else if (animState === 'returning') {
        const homeAngles = clampAllJoints({ ...HOME_ANGLES })
        useStore.setState({ fromAngles: currentAngles, toAngles: homeAngles })
        store.addLog('info', 'Returning to HOME…')
      } else {
        // grabbing / releasing: hold in place
        useStore.setState({ fromAngles: currentAngles, toAngles: currentAngles })
      }
      return
    }

    // ── Advance the current segment ──────────────────────────────────────────
    const duration = SPEED[animState] || 1.0
    progressRef.current = Math.min(1, progressRef.current + delta / duration)
    const t = easeInOutCubic(progressRef.current)

    useStore.setState({ animProgress: progressRef.current })

    if (fromAngles && toAngles && robotRef) {
      const interp = lerpAngles(fromAngles, toAngles, t)
      applyAnglesToRobot(robotRef, interp)
      useStore.setState({ jointAngles: { ...interp } })
    }

    // ── Segment complete ─────────────────────────────────────────────────────
    if (progressRef.current >= 1) {
      _onSegmentComplete(store, animState)
    }
  })

  return null
}

// ─── Solve IK and set fromAngles/toAngles for a motion segment ────────────
function _solveSegment(store, target, currentAngles) {
  const { robotRef, startObject, endObject, addLog } = store
  if (!robotRef) return

  const obj = target === 'start' ? startObject : endObject

  // Grab geometry — we want the gripper's pinch point to land exactly on
  // the centre of the face that the grab vector points out of, and the
  // gripper to approach perpendicular to that face (tool axis = -grabDir).
  const { faceCenter, toolZ } = computeGrabPose(obj.position, obj.rotation, obj.grabVector)

  addLog('info', `IK: solving for ${target.toUpperCase()}`, {
    X: faceCenter.x.toFixed(3),
    Y: faceCenter.y.toFixed(3),
    Z: faceCenter.z.toFixed(3),
  })

  // Solve orientation-aware IK
  const solved = solveCCDIK(robotRef, faceCenter, toolZ, 160, 0.005)

  if (solved) {
    const clamped = clampAllJoints(solved)
    // Restore current angles — animation will interpolate from here
    applyAnglesToRobot(robotRef, currentAngles)
    addLog('ok', `IK converged for ${target.toUpperCase()}`, _logAngles(clamped))
    useStore.setState({ fromAngles: currentAngles, toAngles: clamped })
  } else {
    addLog('warn', `IK did not converge for ${target} — target may be out of reach`)
    applyAnglesToRobot(robotRef, currentAngles)
    useStore.setState({ fromAngles: currentAngles, toAngles: currentAngles })
  }
}

// ─── Log what happened, advance to next state ────────────────────────────
function _onSegmentComplete(store, current) {
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
