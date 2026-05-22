/**
 * roboclaw — a React + Three.js library for simulating a 6-axis robot arm
 * doing pick-and-place tasks, optionally riding on a mobile platform.
 *
 * Public surface (what an app should import):
 *
 *   import {
 *     RobotArm, AnimationController, WorkObject, WorkingEnvelope,
 *     useStore, createRobotStore, RobotStoreProvider, useRobotStore,
 *     JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA,
 *     solveCCDIK, computeGrabPose, getToolPose,
 *     KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR,
 *   } from 'roboclaw'
 *
 * Single-robot apps just use `useStore` (the singleton).  Multi-robot apps
 * call `createRobotStore()` once per arm and wrap each <RobotArm> /
 * <AnimationController> pair in <RobotStoreProvider store={...}>.
 */

// Scene components
export { default as RobotArm,
         KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR, GRIPPER_REACH }
  from './components/RobotArm.jsx'
export { default as AnimationController } from './components/AnimationController.jsx'
export { default as WorkObject, BOX_HALF }  from './components/WorkObject.jsx'
export { default as CarriedObject }         from './components/CarriedObject.jsx'
export { default as WorkingEnvelope }       from './components/WorkingEnvelope.jsx'

// State (the global store + factory for multi-robot use)
export { default as useStore,
         createRobotStore,
         JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA }
  from './state/useStore.js'
export { RobotStoreProvider, useRobotStore } from './state/context.jsx'

// Inverse-kinematics primitives
export {
  solveCCDIK, solveIK,
  computeGrabPose, getToolPose, getEndEffectorPose,
  applyAnglesToRobot, readAnglesFromRobot,
  clampJoint, clampAllJoints,
  lerpAngles, easeInOutCubic,
  PINCH_Z,
} from './ik/ikSolver.js'
