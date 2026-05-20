/**
 * roboclaw — a React + Three.js library for simulating a 6-axis robot arm
 * doing pick-and-place tasks, optionally riding on a mobile platform.
 *
 * Public surface (what an app should import):
 *
 *   import {
 *     RobotArm, AnimationController, WorkObject, WorkingEnvelope,
 *     useStore, JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA,
 *     solveCCDIK, computeGrabPose, getToolPose,
 *     KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR,
 *   } from 'roboclaw'   // or '<repo>/src/lib' until published
 *
 * Everything in `./components`, `./state`, and `./ik` is intentionally
 * exported so power users can reach into internals when they need to.
 * The named exports below are the stable surface.
 *
 * NOTE — v1 ships with a SINGLE-ROBOT singleton store.  When you need
 * multiple arms in the same scene, look at `state/useStore.js` — that
 * file is the one place that needs converting into a factory.
 */

// Scene components
export { default as RobotArm,
         KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR, GRIPPER_REACH }
  from './components/RobotArm.jsx'
export { default as AnimationController } from './components/AnimationController.jsx'
export { default as WorkObject, BOX_HALF }  from './components/WorkObject.jsx'
export { default as WorkingEnvelope }       from './components/WorkingEnvelope.jsx'

// State (the global store)
export { default as useStore,
         JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA }
  from './state/useStore.js'

// Inverse-kinematics primitives
export {
  solveCCDIK, solveIK,
  computeGrabPose, getToolPose, getEndEffectorPose,
  applyAnglesToRobot, readAnglesFromRobot,
  clampJoint, clampAllJoints,
  lerpAngles, easeInOutCubic,
  PINCH_Z,
} from './ik/ikSolver.js'
