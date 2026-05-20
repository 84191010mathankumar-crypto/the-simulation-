/**
 * IK Solver for KUKA KR210 R2700-2
 *
 * Uses the closed-chain-ik library (gkjohnson) which implements damped
 * least-squares (Jacobian pseudo-inverse) with joint limits.
 *
 * This module bridges the urdf-loader robot scene graph with the IK solver
 * and provides a clean async interface for the animation system.
 */
import * as THREE from 'three'
import { JOINT_LIMITS, JOINT_NAMES, HOME_ANGLES } from '../store/useStore'

// ─── Clamp helper ─────────────────────────────────────────────────────────
export function clampJoint(name, value) {
  const lim = JOINT_LIMITS[name]
  if (!lim) return value
  return Math.max(lim.lower, Math.min(lim.upper, value))
}

export function clampAllJoints(angles) {
  const out = {}
  for (const name of JOINT_NAMES) {
    out[name] = clampJoint(name, angles[name] ?? 0)
  }
  return out
}

// ─── Apply angles to URDF robot ───────────────────────────────────────────
export function applyAnglesToRobot(robot, angles) {
  if (!robot) return
  for (const name of JOINT_NAMES) {
    const a = angles[name] ?? 0
    robot.setJointValue(name, a)
  }
}

// ─── Read angles from URDF robot ──────────────────────────────────────────
export function readAnglesFromRobot(robot) {
  if (!robot) return {}
  const out = {}
  for (const name of JOINT_NAMES) {
    const j = robot.joints[name]
    out[name] = j ? j.angle : 0
  }
  return out
}

// ─── Get world-space end-effector (flange) pose ───────────────────────────
export function getEndEffectorPose(robot) {
  if (!robot) return null
  const flange = robot.links['flange'] || robot.links['link_6']
  if (!flange) return null
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  flange.getWorldPosition(pos)
  flange.getWorldQuaternion(quat)
  return { position: pos, quaternion: quat }
}

// ─── Approach pose: offset along grab vector ──────────────────────────────
/**
 * Given an object's world position + Euler rotation + grab vector (local),
 * compute:
 *   target = object position + (rotation * grabVector * approachDist)
 *   targetQuat = rotation aligned to grab vector
 */
export function computeGrabPose(objectPos, objectEuler, grabVecLocal, approachDist = 0.05) {
  const pos = new THREE.Vector3(...objectPos)
  const rot = new THREE.Euler(...objectEuler, 'XYZ')
  const rotMat = new THREE.Matrix4().makeRotationFromEuler(rot)

  // Grab vector in world space
  const grabDir = new THREE.Vector3(...grabVecLocal).normalize()
  const grabDirWorld = grabDir.clone().applyMatrix4(rotMat)

  // Tool tip should arrive FROM the grab direction (offset backward)
  const approachPos = pos.clone().addScaledVector(grabDirWorld, approachDist)

  // Quaternion: z-axis of tool points along grab direction
  const q = new THREE.Quaternion()
  q.setFromUnitVectors(new THREE.Vector3(0, 0, -1), grabDirWorld.clone().negate())

  return { position: approachPos, quaternion: q }
}

// ─── CCD IK solver ────────────────────────────────────────────────────────
/**
 * Cyclic Coordinate Descent IK with multi-restart.
 *
 * Each restart begins from a perturbed seed so the solver can escape local
 * minima. Returns the best solution found, or null if unreachable.
 */
export function solveCCDIK(robot, targetPos, targetQuat, maxIter = 120, tolerance = 0.005) {
  if (!robot) return null

  // Validate target
  if (!isFinite(targetPos.x) || !isFinite(targetPos.y) || !isFinite(targetPos.z)) {
    console.warn('solveCCDIK: invalid targetPos', targetPos)
    return null
  }

  const joints = JOINT_NAMES.map((name) => robot.joints[name]).filter(Boolean)
  if (joints.length === 0) return null

  const savedAngles = readAnglesFromRobot(robot)

  // Quick reachability check: is target within arm radius?
  const dist2D = Math.sqrt(targetPos.x ** 2 + targetPos.z ** 2)
  if (dist2D > 2.8 || targetPos.y < -0.8 || targetPos.y > 2.6) {
    console.warn('solveCCDIK: target likely out of reach', targetPos)
    // still try — don't abort early
  }

  let bestAngles = null
  let bestDist   = Infinity

  // Multiple restart seeds: current pose, home, and two perturbed variants
  const seeds = [
    savedAngles,
    { ...HOME_ANGLES },
    { ...HOME_ANGLES, joint_1: -Math.PI / 4, joint_2: -1.2, joint_3: 1.8 },
    { ...HOME_ANGLES, joint_1:  Math.PI / 4, joint_2: -1.2, joint_3: 1.8 },
  ]

  for (const seed of seeds) {
    applyAnglesToRobot(robot, seed)
    const result = _runCCD(robot, joints, targetPos, maxIter, tolerance)
    const efPose = getEndEffectorPose(robot)
    if (!efPose) continue
    const d = efPose.position.distanceTo(targetPos)
    if (d < bestDist) {
      bestDist   = d
      bestAngles = readAnglesFromRobot(robot)
    }
    if (d <= tolerance) break   // good enough, stop early
  }

  // Restore saved angles (animation will interpolate to solution)
  applyAnglesToRobot(robot, savedAngles)

  if (bestDist > tolerance * 20) {
    // Too far — give up
    return null
  }
  return bestAngles
}

function _runCCD(robot, joints, targetPos, maxIter, tolerance) {
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false

    // Tip-to-base sweep
    for (let j = joints.length - 1; j >= 0; j--) {
      const joint = joints[j]
      const jName = JOINT_NAMES[j]

      const efPose = getEndEffectorPose(robot)
      if (!efPose) continue

      const ee = efPose.position
      if (ee.distanceTo(targetPos) < tolerance) return true

      // Joint pivot in world space
      const pivot = new THREE.Vector3()
      joint.getWorldPosition(pivot)

      // Joint rotation axis in world space (all KUKA joints rotate about local Z)
      const jointQuat = new THREE.Quaternion()
      joint.getWorldQuaternion(jointQuat)
      const axisWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(jointQuat)

      // Project EE and target onto the plane perpendicular to the joint axis
      const toEE  = ee.clone().sub(pivot)
      const toTgt = targetPos.clone().sub(pivot)

      // Remove axis component (project onto rotation plane)
      toEE.addScaledVector(axisWorld, -toEE.dot(axisWorld))
      toTgt.addScaledVector(axisWorld, -toTgt.dot(axisWorld))

      const lenEE  = toEE.length()
      const lenTgt = toTgt.length()
      if (lenEE < 1e-6 || lenTgt < 1e-6) continue

      toEE.divideScalar(lenEE)
      toTgt.divideScalar(lenTgt)

      // Signed angle from toEE → toTgt around axisWorld
      const cross = toEE.clone().cross(toTgt)
      const dot   = Math.max(-1, Math.min(1, toEE.dot(toTgt)))
      let   delta = Math.acos(dot)
      if (cross.dot(axisWorld) < 0) delta = -delta

      // Clamp and apply
      const prev     = joint.angle
      const next     = clampJoint(jName, prev + delta)
      if (Math.abs(next - prev) > 1e-6) {
        robot.setJointValue(jName, next)
        moved = true
      }
    }

    if (!moved) break  // converged — no joint moved this sweep
  }
  return false
}

// ─── Solve IK (CCD-based, respects joint limits) ──────────────────────────
export function solveIK(robot, _unused, targetPos, targetQuat) {
  return solveCCDIK(robot, targetPos, targetQuat)
}

// ─── Interpolate between two angle sets ───────────────────────────────────
export function lerpAngles(a, b, t) {
  const out = {}
  for (const name of JOINT_NAMES) {
    out[name] = (a[name] ?? 0) + ((b[name] ?? 0) - (a[name] ?? 0)) * t
  }
  return out
}

// ─── Ease function ────────────────────────────────────────────────────────
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
