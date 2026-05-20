/**
 * IK Solver for KUKA KR210 R2700-2 with parallel-jaw gripper.
 *
 * Orientation-aware Cyclic Coordinate Descent with multi-restart.
 *
 * The tool frame is the URDF "tool0" link.  Its local +Z is the tool axis;
 * the gripper extends along that +Z.  The pinch point (between the finger
 * pads) sits at TOOL_TIP_OFFSET = (0, 0, PINCH_Z) in tool0-local.
 *
 * IK is solved so that:
 *   pinch_point_world  →  targetPos
 *   tool0_localZ_world →  targetZ        (gripper points at the face)
 */
import * as THREE from 'three'
import { JOINT_LIMITS, JOINT_NAMES, HOME_ANGLES } from '../state/constants.js'

// Distance from tool0 origin to the pinch centre between the two finger pads
export const PINCH_Z = 0.18
const TOOL_TIP_OFFSET = new THREE.Vector3(0, 0, PINCH_Z)

// ─── Clamp helpers ────────────────────────────────────────────────────────
export function clampJoint(name, value) {
  const lim = JOINT_LIMITS[name]
  if (!lim) return value
  return Math.max(lim.lower, Math.min(lim.upper, value))
}

export function clampAllJoints(angles) {
  const out = {}
  for (const name of JOINT_NAMES) out[name] = clampJoint(name, angles[name] ?? 0)
  return out
}

// ─── Apply / read angles ──────────────────────────────────────────────────
export function applyAnglesToRobot(robot, angles) {
  if (!robot) return
  for (const name of JOINT_NAMES) {
    const a = angles[name] ?? 0
    robot.setJointValue(name, a)
  }
}

export function readAnglesFromRobot(robot) {
  if (!robot) return {}
  const out = {}
  for (const name of JOINT_NAMES) {
    const j = robot.joints[name]
    out[name] = j ? j.angle : 0
  }
  return out
}

// ─── Tool frame pose (pinch + axis) ───────────────────────────────────────
function getToolLink(robot) {
  return robot.links?.tool0 || robot.links?.flange || robot.links?.link_6 || null
}

export function getToolPose(robot) {
  const tool = getToolLink(robot)
  if (!tool) return null
  const pos = new THREE.Vector3();    tool.getWorldPosition(pos)
  const quat = new THREE.Quaternion();tool.getWorldQuaternion(quat)
  const Zw = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
  const pinch = pos.clone().addScaledVector(Zw, PINCH_Z)
  return { pos, quat, Zw, pinch }
}

// Back-compat — used by some callers; returns flange world pose.
export function getEndEffectorPose(robot) {
  const link = robot.links?.flange || robot.links?.link_6
  if (!link) return null
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  link.getWorldPosition(position)
  link.getWorldQuaternion(quaternion)
  return { position, quaternion }
}

// ─── Grab pose computation ────────────────────────────────────────────────
/**
 * Given the box centre, rotation and outward grab direction, return
 *   faceCenter   – the centre of the box face we are gripping (target for pinch)
 *   toolZ        – desired world direction of the tool axis (gripper +Z),
 *                  which is INWARD (-grabDir) so the fingers point AT the face
 *   grabDirWorld – the outward grab direction in world space
 */
export function computeGrabPose(objectPos, objectEuler, grabVecLocal, boxHalf = 0.075) {
  const pos = new THREE.Vector3(...objectPos)
  const eul = new THREE.Euler(objectEuler[0], objectEuler[1], objectEuler[2], 'XYZ')
  const rotMat = new THREE.Matrix4().makeRotationFromEuler(eul)

  const grabLocal  = new THREE.Vector3(...grabVecLocal).normalize()
  const grabDirWorld = grabLocal.clone().applyMatrix4(rotMat).normalize()

  const faceCenter = pos.clone().addScaledVector(grabDirWorld, boxHalf)
  const toolZ      = grabDirWorld.clone().negate()   // gripper points at face

  // Legacy fields kept for any caller still expecting { position, quaternion }
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    toolZ,
  )
  return { faceCenter, toolZ, grabDirWorld, position: faceCenter, quaternion }
}

// ─── Orientation-aware CCD ────────────────────────────────────────────────
/**
 * Multi-restart CCD that converges both pinch-point position AND tool-axis
 * direction.  Returns the best joint solution or null if unreachable.
 */
export function solveCCDIK(robot, targetPos, targetZ, maxIter = 160, tolerance = 0.005) {
  if (!robot) return null
  if (!isFinite(targetPos.x) || !isFinite(targetPos.y) || !isFinite(targetPos.z)) {
    console.warn('solveCCDIK: invalid targetPos', targetPos)
    return null
  }

  const joints = JOINT_NAMES.map((n) => robot.joints[n]).filter(Boolean)
  if (joints.length === 0) return null

  const savedAngles = readAnglesFromRobot(robot)

  const tZ = targetZ.clone().normalize()

  // Restart seeds — wide variety so we escape local minima
  const seeds = [
    savedAngles,
    { ...HOME_ANGLES },
    { ...HOME_ANGLES, joint_1: -Math.PI / 4, joint_2: -1.2, joint_3: 1.6 },
    { ...HOME_ANGLES, joint_1:  Math.PI / 4, joint_2: -1.2, joint_3: 1.6 },
    { ...HOME_ANGLES, joint_1:  Math.PI,     joint_2: -1.0, joint_3: 1.4 },
    { ...HOME_ANGLES, joint_1: -Math.PI / 2, joint_2: -1.8, joint_3: 2.0, joint_5: 1.2 },
  ]

  let bestAngles = null
  let bestScore  = Infinity

  for (const seed of seeds) {
    applyAnglesToRobot(robot, seed)
    _runCCD(robot, joints, targetPos, tZ, maxIter, tolerance)
    const pose = getToolPose(robot)
    if (!pose) continue
    const dPos = pose.pinch.distanceTo(targetPos)
    const dOri = Math.acos(Math.max(-1, Math.min(1, pose.Zw.dot(tZ))))   // 0..π
    // Combined score: 1 mm position error ≈ 1° orientation error
    const score = dPos + dOri * 0.06
    if (score < bestScore) {
      bestScore = score
      bestAngles = readAnglesFromRobot(robot)
    }
    if (dPos < tolerance && dOri < 0.02) break
  }

  // Restore — animation will lerp from current pose
  applyAnglesToRobot(robot, savedAngles)

  if (bestScore > tolerance * 30) return null
  return bestAngles
}

function _runCCD(robot, joints, targetPos, targetZ, maxIter, tolerance) {
  for (let iter = 0; iter < maxIter; iter++) {
    let moved = false

    // Tip-to-base sweep
    for (let j = joints.length - 1; j >= 0; j--) {
      const joint = joints[j]
      const jName = JOINT_NAMES[j]

      const pose = getToolPose(robot)
      if (!pose) continue
      const { pinch, Zw } = pose

      // Convergence
      const posErr = pinch.distanceTo(targetPos)
      const oriErr = Math.acos(Math.max(-1, Math.min(1, Zw.dot(targetZ))))
      if (posErr < tolerance && oriErr < 0.02) return true

      // Joint pivot + axis in world
      const pivot = new THREE.Vector3(); joint.getWorldPosition(pivot)
      const jQuat = new THREE.Quaternion(); joint.getWorldQuaternion(jQuat)
      const axisW = new THREE.Vector3(0, 0, 1).applyQuaternion(jQuat)

      // ── Position-correcting rotation about axisW ──
      let posDelta = 0
      {
        const toEE  = pinch.clone().sub(pivot)
        const toTgt = targetPos.clone().sub(pivot)
        toEE.addScaledVector(axisW, -toEE.dot(axisW))
        toTgt.addScaledVector(axisW, -toTgt.dot(axisW))
        const lA = toEE.length(), lB = toTgt.length()
        if (lA > 1e-6 && lB > 1e-6) {
          toEE.divideScalar(lA); toTgt.divideScalar(lB)
          const cross = toEE.clone().cross(toTgt)
          const dot = Math.max(-1, Math.min(1, toEE.dot(toTgt)))
          posDelta = Math.acos(dot)
          if (cross.dot(axisW) < 0) posDelta = -posDelta
        }
      }

      // ── Orientation-correcting rotation (align Zw to targetZ) ──
      let oriDelta = 0
      {
        const a = Zw.clone(), b = targetZ.clone()
        a.addScaledVector(axisW, -a.dot(axisW))
        b.addScaledVector(axisW, -b.dot(axisW))
        const lA = a.length(), lB = b.length()
        if (lA > 1e-6 && lB > 1e-6) {
          a.divideScalar(lA); b.divideScalar(lB)
          const cross = a.clone().cross(b)
          const dot = Math.max(-1, Math.min(1, a.dot(b)))
          oriDelta = Math.acos(dot)
          if (cross.dot(axisW) < 0) oriDelta = -oriDelta
        }
      }

      // Weighted blend:
      //   base joints (1-3) → mostly drive position
      //   wrist joints (4-6) → mostly drive orientation
      const wOri = j >= 3 ? 0.80 : 0.12

      // Damp by current error so we don't overshoot when nearly converged
      const posScale = Math.min(1.0, posErr / 0.05)
      const oriScale = Math.min(1.0, oriErr / 0.4)
      const delta = (1 - wOri) * posDelta * posScale + wOri * oriDelta * oriScale

      const prev = joint.angle
      const next = clampJoint(jName, prev + delta)
      if (Math.abs(next - prev) > 1e-7) {
        robot.setJointValue(jName, next)
        moved = true
      }
    }

    if (!moved) break
  }
  return false
}

// ─── Back-compat shim ─────────────────────────────────────────────────────
export function solveIK(robot, _unused, targetPos, targetQuat) {
  // Default tool axis to -Y world (downward grab) if no quaternion provided
  const tZ = targetQuat
    ? new THREE.Vector3(0, 0, 1).applyQuaternion(targetQuat)
    : new THREE.Vector3(0, -1, 0)
  return solveCCDIK(robot, targetPos, tZ)
}

// ─── Interpolation helpers ────────────────────────────────────────────────
export function lerpAngles(a, b, t) {
  const out = {}
  for (const name of JOINT_NAMES) {
    out[name] = (a[name] ?? 0) + ((b[name] ?? 0) - (a[name] ?? 0)) * t
  }
  return out
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}
