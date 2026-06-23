/**
 * State for the gantry robot demo.
 *
 * A gantry robot is much simpler to drive than the 6-axis arm: the gripper's
 * position is just three straight-line travel axes (X, Y, Z) plus one
 * rotation around the vertical axis — no inverse kinematics needed, the
 * gripper tip position *is* the target position.
 *
 * Single-gantry apps just use the default singleton (`useGantryStore`).
 * Multi-gantry apps (e.g. the site planner, which can place several gantry
 * areas) call `createGantryStore()` once per gantry and wrap each
 * <GantryRobot> / <GantryAnimationController> / <GantryCarriedObject> in a
 * <GantryStoreProvider store={...}>, exactly mirroring the arm's
 * createRobotStore / RobotStoreProvider pattern.
 */
import { create } from 'zustand'

// How high the gantry's rails sit above the floor.
export const RAIL_Y = 1.85
// Safe travel height the gripper retracts to while moving sideways, so it
// clears the boxes and frame legs.
export const TRAVEL_Y = 1.55

export const BOX_HALF = 0.11

export const HOME_POSE = { x: 0, y: TRAVEL_Y, z: 0, rotY: 0 }

/** Factory — one independent gantry store per call. */
export function createGantryStore() {
  return create((set, get) => ({
    // ── Gripper pose — this IS the tool tip position, no IK involved ────────
    pose: { ...HOME_POSE },
    gripperOpen: true,
    carrying: false,

    // ── Pick / place targets ─────────────────────────────────────────────────
    startObject: { position: [-1.1, BOX_HALF, 0.85], rotY: 0 },
    endObject:   { position: [1.2, BOX_HALF, -0.75], rotY: Math.PI / 2 },

    // ── Animation state machine ───────────────────────────────────────────────
    animState: 'idle',
    animProgress: 0,

    // ── Log ────────────────────────────────────────────────────────────────────
    logs: [],

    // ── Actions ────────────────────────────────────────────────────────────────
    setPose:         (p) => set({ pose: p }),
    setGripperOpen:  (v) => set({ gripperOpen: v }),
    setCarrying:     (v) => set({ carrying: v }),
    setStartObject:  (patch) => set((s) => ({ startObject: { ...s.startObject, ...patch } })),
    setEndObject:    (patch) => set((s) => ({ endObject:   { ...s.endObject,   ...patch } })),
    setAnimState:    (v) => set({ animState: v }),
    setAnimProgress: (p) => set({ animProgress: p }),

    addLog: (level, msg) => {
      const entry = { id: get().logs.length + Math.random(), ts: performance.now(), level, msg }
      set((s) => ({ logs: [entry, ...s.logs].slice(0, 200) }))
    },
    clearLogs: () => set({ logs: [] }),

    resetToHome: () => set({
      pose: { ...HOME_POSE },
      gripperOpen: true,
      carrying: false,
      animState: 'idle',
      animProgress: 0,
    }),
  }))
}

// Default singleton — what single-gantry apps (and the gantry/warehouse demos)
// use when no <GantryStoreProvider> wraps the tree.
const useGantryStore = createGantryStore()

export default useGantryStore
