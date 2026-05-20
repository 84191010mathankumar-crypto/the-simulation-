/**
 * Static, robot-specific constants — joint names / limits / home pose /
 * working envelope.  These belong neither to the live runtime store nor to
 * the IK math; they're shared by both.
 *
 * Today they describe the KUKA KR210 R2700-2.  When we add support for a
 * second robot model, this file becomes a per-model export and the store
 * factory takes the chosen constants as a parameter.
 */

// Joint names in order for KR210 R2700-2
export const JOINT_NAMES = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6']

// Joint limits in radians (from URDF)
export const JOINT_LIMITS = {
  joint_1: { lower: -3.2289, upper:  3.2289 },
  joint_2: { lower: -2.4435, upper: -0.0873 },
  joint_3: { lower: -2.0944, upper:  2.9322 },
  joint_4: { lower: -6.1087, upper:  6.1087 },
  joint_5: { lower: -2.1817, upper:  2.1817 },
  joint_6: { lower: -6.1087, upper:  6.1087 },
}

// Home pose — joint_2/3 mid-range so the arm points roughly upright.
export const HOME_ANGLES = {
  joint_1: 0,
  joint_2: -1.57,
  joint_3:  1.57,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
}

// KR210 R2700-2 DH working envelope: 2700 mm reach, max Z ~2400 mm
export const WORKING_AREA = {
  radius: 2.7,
  minZ:  -0.7,
  maxZ:   2.5,
}
