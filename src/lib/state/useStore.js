/**
 * Global store for the (currently single) robot arm + its work objects.
 *
 * The lib intentionally ships a singleton zustand store — a small, readable
 * surface that lets the demo (and external apps) drive everything by calling
 * actions and reading state.  When you need multiple arms in the same scene,
 * convert this file into a factory that returns a fresh store per instance.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ── Robot constants ────────────────────────────────────────────────────────
export const JOINT_NAMES = ['joint_1','joint_2','joint_3','joint_4','joint_5','joint_6']

// Joint limits in radians (from the KR210 URDF)
export const JOINT_LIMITS = {
  joint_1: { lower: -3.2289, upper:  3.2289 },
  joint_2: { lower: -2.4435, upper: -0.0873 },
  joint_3: { lower: -2.0944, upper:  2.9322 },
  joint_4: { lower: -6.1087, upper:  6.1087 },
  joint_5: { lower: -2.1817, upper:  2.1817 },
  joint_6: { lower: -6.1087, upper:  6.1087 },
}

// Sensible parked pose — arm pointing roughly up, wrist straight.
export const HOME_ANGLES = {
  joint_1: 0,
  joint_2: -1.57,
  joint_3:  1.57,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
}

// KR210 R2700-2 working envelope: 2.7 m reach, ~2.5 m vertical above the base.
export const WORKING_AREA = {
  radius: 2.7,
  minZ: -0.7,
  maxZ:  2.5,
}

const initialJointAngles = { ...HOME_ANGLES }

let logId = 0

const useStore = create(subscribeWithSelector((set, get) => ({
  // ── Robot state ───────────────────────────────────────────────────────────
  jointAngles: { ...initialJointAngles },
  robotLoaded: false,
  robotRef: null,
  ikSolverRef: null,

  // ── Work objects (the "pick" and "place" boxes) ───────────────────────────
  // grabVector is a unit vector in the object's local frame pointing OUT of
  // the face the gripper approaches.
  startObject: {
    position: [0.8, 0.4, 0.5],
    rotation: [0, 0, 0],
    grabVector: [0, 1, 0],
  },
  endObject: {
    position: [0.8, -0.4, 0.5],
    rotation: [0, 0, 0],
    grabVector: [0, 1, 0],
  },

  // ── UI selection ──────────────────────────────────────────────────────────
  selectedObject: 'start',
  transformMode: 'translate',

  // ── Animation state ───────────────────────────────────────────────────────
  // 'idle' | 'moving_to_start' | 'grabbing' | 'moving_to_end' | 'releasing' | 'returning'
  animState: 'idle',
  animProgress: 0,
  fromAngles: null,
  toAngles: null,

  // ── Follow mode ───────────────────────────────────────────────────────────
  // null | 'start' | 'end' — continuously IK-solve as the user drags the gumball.
  followTarget: null,

  // ── Mobile platform (AGV) ─────────────────────────────────────────────────
  mobileMode: false,
  platformPose: { position: [0, 0, 0], rotation: [0, 0, 0] },
  platformGroupRef: null,
  fromPlatform: null,
  toPlatform: null,

  // ── Log ───────────────────────────────────────────────────────────────────
  logs: [],

  // ── Actions ───────────────────────────────────────────────────────────────
  setRobotLoaded: (v) => set({ robotLoaded: v }),
  setRobotRef:    (r) => set({ robotRef: r }),
  setIkSolverRef: (r) => set({ ikSolverRef: r }),

  setJointAngles: (angles) => set({ jointAngles: { ...angles } }),

  setStartObject: (patch) => set((s) => ({ startObject: { ...s.startObject, ...patch } })),
  setEndObject:   (patch) => set((s) => ({ endObject:   { ...s.endObject,   ...patch } })),

  setSelectedObject: (v) => set({ selectedObject: v }),
  setTransformMode:  (v) => set({ transformMode: v }),

  setAnimState:        (v) => set({ animState: v }),
  setFollowTarget:     (v) => set({ followTarget: v }),
  setMobileMode:       (v) => set({ mobileMode: v }),
  setPlatformPose:     (p) => set({ platformPose: p }),
  setPlatformGroupRef: (r) => set({ platformGroupRef: r }),
  setAnimProgress:     (p) => set({ animProgress: p }),
  setAnimSegment: (from, to) => set({ fromAngles: from, toAngles: to }),

  addLog: (level, msg, extra) => {
    const entry = { id: logId++, ts: performance.now(), level, msg, extra }
    set((s) => ({ logs: [entry, ...s.logs].slice(0, 200) }))
  },
  clearLogs: () => set({ logs: [] }),

  resetToHome: () => set({
    jointAngles: { ...HOME_ANGLES },
    animState: 'idle',
    animProgress: 0,
  }),
})))

export default useStore
