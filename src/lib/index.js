/**
 * roboclaw — a React + Three.js library for simulating a 6-axis robot arm
 * doing pick-and-place tasks, optionally riding on a mobile platform.
 *
 * Public surface:
 *
 *   import {
 *     // scene components
 *     RobotArm, AnimationController, WorkObject, WorkingEnvelope,
 *
 *     // state
 *     createRobotStore, RobotStoreProvider, useRobotStore, useRobotStoreApi,
 *
 *     // constants
 *     JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA,
 *
 *     // IK math
 *     solveCCDIK, computeGrabPose, getToolPose,
 *
 *     // default asset paths
 *     KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR,
 *   } from 'roboclaw'
 *
 * Multi-robot usage — each <RobotStoreProvider> is an isolated scope.  Either
 * create stores explicitly:
 *
 *   const armA = createRobotStore()
 *   const armB = createRobotStore()
 *   <RobotStoreProvider store={armA}> <RobotArm /> ... </RobotStoreProvider>
 *   <RobotStoreProvider store={armB}> <RobotArm /> ... </RobotStoreProvider>
 *
 * …or for single-robot demos, leave `store` off and one is created lazily.
 */

// Scene components
export { default as RobotArm,
         KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR, GRIPPER_REACH }
  from './components/RobotArm.jsx'
export { default as AnimationController } from './components/AnimationController.jsx'
export { default as WorkObject, BOX_HALF }  from './components/WorkObject.jsx'
export { default as WorkingEnvelope }       from './components/WorkingEnvelope.jsx'

// State — factory, provider, hooks
export {
  createRobotStore,
  RobotStoreProvider,
  useRobotStore,
  useRobotStoreApi,
} from './state/store.jsx'

// Constants
export {
  JOINT_NAMES, JOINT_LIMITS, HOME_ANGLES, WORKING_AREA,
} from './state/constants.js'

// Inverse-kinematics primitives
export {
  solveCCDIK, solveIK,
  computeGrabPose, getToolPose, getEndEffectorPose,
  applyAnglesToRobot, readAnglesFromRobot,
  clampJoint, clampAllJoints,
  lerpAngles, easeInOutCubic,
  PINCH_Z,
} from './ik/ikSolver.js'
