import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  clampJoint, clampAllJoints,
  lerpAngles, easeInOutCubic,
  computeGrabPose, PINCH_Z,
} from './ikSolver.js'
import { HOME_ANGLES, JOINT_LIMITS, JOINT_NAMES } from '../state/constants.js'

describe('clampJoint', () => {
  it('returns the input when within bounds', () => {
    expect(clampJoint('joint_1', 0.5)).toBe(0.5)
  })

  it('snaps below-lower up to the lower limit', () => {
    expect(clampJoint('joint_1', -10)).toBe(JOINT_LIMITS.joint_1.lower)
  })

  it('snaps above-upper down to the upper limit', () => {
    expect(clampJoint('joint_1', 10)).toBe(JOINT_LIMITS.joint_1.upper)
  })

  it('passes through unknown joint names unchanged', () => {
    expect(clampJoint('not_a_joint', 123)).toBe(123)
  })

  it('respects joint_2\'s asymmetric range', () => {
    // joint_2 limits: lower -2.4435, upper -0.0873
    expect(clampJoint('joint_2', 0)).toBeCloseTo(-0.0873, 4)
    expect(clampJoint('joint_2', -5)).toBeCloseTo(-2.4435, 4)
  })
})

describe('clampAllJoints', () => {
  it('clamps every joint, preserving the input shape', () => {
    const out = clampAllJoints({
      joint_1: 99,
      joint_2: -99,
      joint_3: 0,
      joint_4: 99,
      joint_5: -99,
      joint_6: 99,
    })
    expect(Object.keys(out)).toEqual(JOINT_NAMES)
    expect(out.joint_1).toBe(JOINT_LIMITS.joint_1.upper)
    expect(out.joint_2).toBe(JOINT_LIMITS.joint_2.lower)
    expect(out.joint_3).toBe(0)
    expect(out.joint_5).toBe(JOINT_LIMITS.joint_5.lower)
  })

  it('treats missing joints as 0 (within most limits)', () => {
    const out = clampAllJoints({})
    for (const n of JOINT_NAMES) expect(out[n]).toBeDefined()
  })
})

describe('lerpAngles', () => {
  it('returns from-pose at t=0', () => {
    const a = { ...HOME_ANGLES, joint_1: 0 }
    const b = { ...HOME_ANGLES, joint_1: 1.0 }
    expect(lerpAngles(a, b, 0).joint_1).toBe(0)
  })

  it('returns to-pose at t=1', () => {
    const a = { ...HOME_ANGLES, joint_1: 0 }
    const b = { ...HOME_ANGLES, joint_1: 1.0 }
    expect(lerpAngles(a, b, 1).joint_1).toBe(1.0)
  })

  it('returns the midpoint at t=0.5', () => {
    const a = { ...HOME_ANGLES, joint_1: 0,   joint_3:  1.57 }
    const b = { ...HOME_ANGLES, joint_1: 1.0, joint_3: -1.57 }
    const m = lerpAngles(a, b, 0.5)
    expect(m.joint_1).toBeCloseTo(0.5, 6)
    expect(m.joint_3).toBeCloseTo(0,   6)
  })
})

describe('easeInOutCubic', () => {
  it('is 0 at t=0 and 1 at t=1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('is symmetric around t=0.5', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6)
    // ease(0.3) + ease(0.7) ≈ 1
    expect(easeInOutCubic(0.3) + easeInOutCubic(0.7)).toBeCloseTo(1, 6)
  })

  it('is monotonically increasing', () => {
    let prev = -Infinity
    for (let i = 0; i <= 20; i++) {
      const v = easeInOutCubic(i / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('computeGrabPose', () => {
  it('places faceCenter on the face that grabVector points out of', () => {
    // Object at origin, grab from above (+Y).  Face centre should be at (0, halfSize, 0).
    const { faceCenter, toolZ } = computeGrabPose(
      [0, 0, 0], [0, 0, 0], [0, 1, 0], /* boxHalf */ 0.075,
    )
    expect(faceCenter.x).toBeCloseTo(0, 6)
    expect(faceCenter.y).toBeCloseTo(0.075, 6)
    expect(faceCenter.z).toBeCloseTo(0, 6)

    // toolZ is the INWARD direction (so the gripper points at the face).
    expect(toolZ.x).toBeCloseTo(0,  6)
    expect(toolZ.y).toBeCloseTo(-1, 6)
    expect(toolZ.z).toBeCloseTo(0,  6)
  })

  it('rotates grabVector by the object\'s rotation', () => {
    // Object rotated 90° about Z — local +Y becomes world -X.
    const { faceCenter, toolZ } = computeGrabPose(
      [0, 0, 0], [0, 0, Math.PI / 2], [0, 1, 0], 0.1,
    )
    expect(faceCenter.x).toBeCloseTo(-0.1, 6)
    expect(faceCenter.y).toBeCloseTo( 0,   6)
    expect(toolZ.x).toBeCloseTo( 1, 6)
    expect(toolZ.y).toBeCloseTo( 0, 6)
  })

  it('offsets faceCenter from object position', () => {
    const { faceCenter } = computeGrabPose(
      [1, 2, 3], [0, 0, 0], [0, 1, 0], 0.075,
    )
    expect(faceCenter.x).toBeCloseTo(1,    6)
    expect(faceCenter.y).toBeCloseTo(2.075, 6)
    expect(faceCenter.z).toBeCloseTo(3,    6)
  })
})

describe('exported constants', () => {
  it('PINCH_Z is positive', () => {
    expect(PINCH_Z).toBeGreaterThan(0)
  })
})
