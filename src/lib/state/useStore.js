/**
 * Per-robot zustand store + a singleton default for backwards-compat with
 * the original single-robot demo.
 *
 *   import useStore from '.../useStore'           // singleton (main demo)
 *   import { createRobotStore } from '.../useStore'  // factory (warehouse)
 *
 * The two are *literally the same shape* — `useStore` is just one fixed
 * instance of `createRobotStore()`.  In the warehouse, one store is created
 * per robot and threaded through a React context (see ./context.jsx) so the
 * existing RobotArm / AnimationController / WorkObject components can run
 * in parallel without any per-robot code-fork.
 *
 * What's new in this revision (for multi-robot):
 *   - `homePlatform`  — per-robot AGV "parking spot" used by the
 *                       `returning` animation segment.  Defaults to (0,0,0)
 *                       so the main demo behaves identically.
 *   - `parkingRef`    — 'origin' | 'self'.  Controls how the AnimationController
 *                       picks a parking pose for a target.  'origin' (default)
 *                       preserves the main demo exactly: park STANDOFF before
 *                       the target along the line FROM world origin.  'self'
 *                       parks STANDOFF before the target along the line FROM
 *                       the robot's CURRENT platform position — what you want
 *                       when many robots roam a shared room.
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

let logId = 0

/**
 * Returns a fresh zustand store with the single-robot state shape.
 * Spawn one per robot in multi-robot scenes.
 */
export function createRobotStore() {
  return create(subscribeWithSelector((set, get) => ({
    // ── Robot state ────────────────────────────────────────────────────────
    jointAngles: { ...HOME_ANGLES },
    robotLoaded: false,
    robotRef: null,
    ikSolverRef: null,

    // ── Work objects (the "pick" and "place" boxes) ────────────────────────
    startObject: {
      position: [-1.0, 1.2, 0.9],
      rotation: [0, 0, 0],
      grabVector: [0, 1, 0],
    },
    endObject: {
      position: [1.2, 0.3, -0.8],
      rotation: [0, 0, 0],
      grabVector: [0, 1, 0],
    },

    // ── UI selection ───────────────────────────────────────────────────────
    selectedObject: 'start',
    transformMode: 'translate',

    // ── Animation state ────────────────────────────────────────────────────
    animState: 'idle',
    animProgress: 0,
    fromAngles: null,
    toAngles: null,

    // ── Follow mode (live IK while dragging the target) ────────────────────
    followTarget: null,

    // ── Mobile platform (AGV) ──────────────────────────────────────────────
    mobileMode: false,
    platformPose:    { position: [0, 0, 0], rotation: [0, 0, 0] },
    homePlatform:    { position: [0, 0, 0], rotation: [0, 0, 0] },  // where to return to
    parkingRef:      'origin',   // 'origin' | 'self' — see file header
    platformGroupRef: null,
    fromPlatform: null,
    toPlatform: null,
    // Waypoints (world positions) the AGV walks through for the current
    // segment — usually just [from, to], or [from, detour-corner, to] when
    // the direct line would cross a restricted zone (see `zones` below).
    platformPath: null,
    // When true, the AGV travels in axis-aligned (X-then-Z) legs instead of a
    // straight diagonal line, so it visually follows the floor grid.
    gridMovement: false,
    // User-drawn no-go rectangles ({ id, minX, maxX, minZ, maxZ }) the AGV
    // routes around instead of driving through.
    zones: [],

    // ── Log ────────────────────────────────────────────────────────────────
    logs: [],

    // ── Actions ────────────────────────────────────────────────────────────
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
    setHomePlatform:     (p) => set({ homePlatform: p }),
    setParkingRef:       (v) => set({ parkingRef: v }),
    setGridMovement:     (v) => set({ gridMovement: v }),
    setZones:            (v) => set({ zones: v }),
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
}

// Default singleton — the main demo's store, also used as the fallback when
// no <RobotStoreProvider> wraps the component tree.
const useStore = createRobotStore()
export default useStore
