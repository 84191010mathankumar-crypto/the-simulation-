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
import { JOINT_LIMITS, JOINT_NAMES } from '../store/useStore'

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

// ─── CCD IK solver (fallback, no external lib needed) ─────────────────────
/**
 * Simple Cyclic Coordinate Descent IK.
 * Iteratively adjusts each joint from tip to base.
 *
 * Returns solved joint angles or null if out of reach.
 */
export function solveCCDIK(robot, targetPos, targetQuat, maxIter = 40, tolerance = 0.005) {
  if (!robot) return null

  const joints = JOINT_NAMES.map((name) => robot.joints[name]).filter(Boolean)
  if (joints.length === 0) return null

  // Work on a copy
  const startAngles = readAnglesFromRobot(robot)

  for (let iter = 0; iter < maxIter; iter++) {
    // Outer loop: iterate joints from tip (joint_6) to base (joint_1)
    for (let j = joints.length - 1; j >= 0; j--) {
      const joint = joints[j]
      const jName = JOINT_NAMES[j]

      // Get current end-effector position
      const efPose = getEndEffectorPose(robot)
      if (!efPose) continue
      const ee = efPose.position

      // Check convergence
      if (ee.distanceTo(targetPos) < tolerance) {
        return readAnglesFromRobot(robot)
      }

      // Vector from joint pivot to EE and to target
      const pivotWorld = new THREE.Vector3()
      joint.getWorldPosition(pivotWorld)

      const toEE     = ee.clone().sub(pivotWorld).normalize()
      const toTarget = targetPos.clone().sub(pivotWorld).normalize()

      // Rotation axis is the joint's local z in world space
      const jointZWorld = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(joint.getWorldQuaternion(new THREE.Quaternion()))
        .normalize()

      // Signed angle between toEE and toTarget around jointZ
      const cross = toEE.clone().cross(toTarget)
      const dot   = Math.max(-1, Math.min(1, toEE.dot(toTarget)))
      let angle   = Math.acos(dot)
      if (cross.dot(jointZWorld) < 0) angle = -angle

      // Apply delta
      const newAngle = clampJoint(jName, joint.angle + angle)
      robot.setJointValue(jName, newAngle)
    }
  }

  // Final convergence check
  const efPose = getEndEffectorPose(robot)
  if (!efPose) {
    applyAnglesToRobot(robot, startAngles)
    return null
  }

  const dist = efPose.position.distanceTo(targetPos)
  if (dist > tolerance * 10) {
    // Failed — restore original
    applyAnglesToRobot(robot, startAngles)
    return null
  }

  return readAnglesFromRobot(robot)
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
