import { create } from 'zustand'

// Joint names in order for KR210 R2700-2
export const JOINT_NAMES = ['joint_1','joint_2','joint_3','joint_4','joint_5','joint_6']

// Joint limits in radians (from URDF)
export const JOINT_LIMITS = {
  joint_1: { lower: -3.2289, upper:  3.2289 },
  joint_2: { lower: -2.4435, upper: -0.0873 },
  joint_3: { lower: -2.0944, upper:  2.9322 },
  joint_4: { lower: -6.1087, upper:  6.1087 },
  joint_5: { lower: -2.1817, upper:  2.1817 },
  joint_6: { lower: -6.1087, upper:  6.1087 },
}

// Robot home position (all zeros = legal for most joints; joint_2 default at midpoint)
export const HOME_ANGLES = {
  joint_1: 0,
  joint_2: -1.57,   // ~-90° — arm pointing straight up
  joint_3:  1.57,   // ~+90°
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
}

// KR210 R2700-2 DH working envelope: 2700 mm reach, max Z ~2400 mm
export const WORKING_AREA = {
  radius: 2.7,   // metres
  minZ: -0.7,    // below base
  maxZ:  2.5,    // above base
}

const initialJointAngles = { ...HOME_ANGLES }

let logId = 0

const useStore = create((set, get) => ({
  // ── Robot state ──────────────────────────────────────────────────
  jointAngles: { ...initialJointAngles },
  robotLoaded: false,
  robotRef: null,         // ref to the URDFRobot Three.js object
  ikSolverRef: null,      // ref to the closed-chain-ik solver

  // ── Object state ─────────────────────────────────────────────────
  // Start object: position + rotation (Euler XYZ, radians) + grab vector
  startObject: {
    position: [0.8, 0.4, 0.5],
    rotation: [0, 0, 0],
    grabVector: [0, 1, 0],   // unit vector: arm approaches from above
  },
  // End object
  endObject: {
    position: [0.8, -0.4, 0.5],
    rotation: [0, 0, 0],
    grabVector: [0, 1, 0],
  },

  // ── Interaction state ─────────────────────────────────────────────
  selectedObject: 'start',   // 'start' | 'end'
  transformMode: 'translate', // 'translate' | 'rotate'

  // ── Animation state ───────────────────────────────────────────────
  // 'idle' | 'moving_to_start' | 'grabbing' | 'moving_to_end' | 'releasing' | 'returning'
  animState: 'idle',
  animProgress: 0,          // 0..1
  fromAngles: null,         // snapshot at start of anim segment
  toAngles: null,           // target angles for anim segment

  // ── Follow mode ──────────────────────────────────────────────────
  // Continuously solve IK to track a target as the user drags it.
  // null | 'start' | 'end'
  followTarget: null,

  // ── Mobile platform ──────────────────────────────────────────────
  // When false, the robot is bolted to a static pedestal at the origin.
  // When true, it rides on a movable AGV-style platform whose pose the
  // user can drag in 3D — extending the workspace anywhere on the floor.
  mobileMode: false,
  platformPose: {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  },
  platformGroupRef: null,    // THREE.Group of the platform — set by SceneView
  fromPlatform:    null,     // anim segment start pose
  toPlatform:      null,     // anim segment end pose

  // ── Log ──────────────────────────────────────────────────────────
  logs: [],

  // ── Actions ──────────────────────────────────────────────────────
  setRobotLoaded: (v) => set({ robotLoaded: v }),
  setRobotRef:    (r) => set({ robotRef: r }),
  setIkSolverRef: (r) => set({ ikSolverRef: r }),

  setJointAngles: (angles) => set({ jointAngles: { ...angles } }),

  setStartObject: (patch) =>
    set((s) => ({ startObject: { ...s.startObject, ...patch } })),
  setEndObject: (patch) =>
    set((s) => ({ endObject: { ...s.endObject, ...patch } })),

  setSelectedObject: (v) => set({ selectedObject: v }),
  setTransformMode:  (v) => set({ transformMode: v }),

  setAnimState: (state) => set({ animState: state }),
  setFollowTarget: (which) => set({ followTarget: which }),
  setMobileMode: (v) => set({ mobileMode: v }),
  setPlatformPose: (pose) => set({ platformPose: pose }),
  setPlatformGroupRef: (r) => set({ platformGroupRef: r }),
  setAnimProgress: (p)  => set({ animProgress: p }),
  setAnimSegment: (from, to) => set({ fromAngles: from, toAngles: to }),

  addLog: (level, msg, extra) => {
    const entry = {
      id: logId++,
      ts: performance.now(),
      level,   // 'info' | 'ok' | 'warn' | 'error'
      msg,
      extra,   // optional object with joint angles etc.
    }
    set((s) => ({
      logs: [entry, ...s.logs].slice(0, 200),
    }))
  },

  clearLogs: () => set({ logs: [] }),

  resetToHome: () => {
    const angles = { ...HOME_ANGLES }
    set({ jointAngles: angles, animState: 'idle', animProgress: 0 })
  },
}))

export default useStore
