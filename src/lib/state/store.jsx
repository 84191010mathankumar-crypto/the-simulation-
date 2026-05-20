/**
 * Per-robot state container.
 *
 *   const store = createRobotStore()
 *   <RobotStoreProvider store={store}>
 *     <RobotArm /> <AnimationController /> ...
 *   </RobotStoreProvider>
 *
 * Inside components:
 *   const angles = useRobotStore((s) => s.jointAngles)        // re-render on change
 *   const api    = useRobotStoreApi()                         // raw store handle
 *   api.getState() / api.setState({...}) / api.subscribe(...)
 *
 * For the single-robot case (the demo), `<RobotStoreProvider>` with no
 * `store` prop auto-creates one.  For multi-robot, create stores explicitly
 * and pass them in — each <RobotStoreProvider> scope is independent.
 *
 * The store ships with `subscribeWithSelector` middleware so the two-arg
 * pattern works:
 *
 *   api.subscribe((s) => s.jointAngles, (angles) => { ... })
 */

import React, { createContext, useContext, useState } from 'react'
import { createStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { HOME_ANGLES } from './constants.js'

// ─── Factory ────────────────────────────────────────────────────────────
export function createRobotStore() {
  let logId = 0    // per-store counter — no global leak across robots

  return createStore(subscribeWithSelector((set) => ({
    // ── Robot state ─────────────────────────────────────────────────
    jointAngles: { ...HOME_ANGLES },
    robotLoaded: false,
    robotRef: null,
    ikSolverRef: null,

    // ── Object state ────────────────────────────────────────────────
    startObject: { position: [0.8,  0.4, 0.5], rotation: [0, 0, 0], grabVector: [0, 1, 0] },
    endObject:   { position: [0.8, -0.4, 0.5], rotation: [0, 0, 0], grabVector: [0, 1, 0] },

    // ── Interaction ─────────────────────────────────────────────────
    selectedObject: 'start',
    transformMode: 'translate',

    // ── Animation ───────────────────────────────────────────────────
    animState: 'idle',
    animProgress: 0,
    fromAngles: null,
    toAngles: null,

    // ── Follow mode ─────────────────────────────────────────────────
    followTarget: null,

    // ── Mobile platform ─────────────────────────────────────────────
    mobileMode: false,
    platformPose: { position: [0, 0, 0], rotation: [0, 0, 0] },
    platformGroupRef: null,
    fromPlatform: null,
    toPlatform: null,

    // ── Log ─────────────────────────────────────────────────────────
    logs: [],

    // ── Actions ─────────────────────────────────────────────────────
    setRobotLoaded:      (v) => set({ robotLoaded: v }),
    setRobotRef:         (r) => set({ robotRef: r }),
    setIkSolverRef:      (r) => set({ ikSolverRef: r }),
    setJointAngles:      (angles) => set({ jointAngles: { ...angles } }),
    setStartObject:      (patch) => set((s) => ({ startObject: { ...s.startObject, ...patch } })),
    setEndObject:        (patch) => set((s) => ({ endObject:   { ...s.endObject,   ...patch } })),
    setSelectedObject:   (v) => set({ selectedObject: v }),
    setTransformMode:    (v) => set({ transformMode: v }),
    setAnimState:        (state) => set({ animState: state }),
    setFollowTarget:     (which) => set({ followTarget: which }),
    setMobileMode:       (v) => set({ mobileMode: v }),
    setPlatformPose:     (p) => set({ platformPose: p }),
    setPlatformGroupRef: (r) => set({ platformGroupRef: r }),
    setAnimProgress:     (p) => set({ animProgress: p }),
    setAnimSegment:      (from, to) => set({ fromAngles: from, toAngles: to }),

    addLog: (level, msg, extra) => set((s) => ({
      logs: [
        { id: logId++, ts: (typeof performance !== 'undefined' ? performance.now() : Date.now()), level, msg, extra },
        ...s.logs,
      ].slice(0, 200),
    })),
    clearLogs:   () => set({ logs: [] }),
    resetToHome: () => set({ jointAngles: { ...HOME_ANGLES }, animState: 'idle', animProgress: 0 }),
  })))
}

// ─── React glue ─────────────────────────────────────────────────────────
const RobotStoreContext = createContext(null)

export function RobotStoreProvider({ store, children }) {
  // If no store is passed, create one lazily so the demo "just works".
  const [resolved] = useState(() => store ?? createRobotStore())
  return <RobotStoreContext.Provider value={resolved}>{children}</RobotStoreContext.Provider>
}

const identity = (s) => s

/** Subscribe to a slice of robot state.  Re-renders on change. */
export function useRobotStore(selector = identity) {
  const store = useContext(RobotStoreContext)
  if (!store) {
    throw new Error('useRobotStore must be used inside <RobotStoreProvider>')
  }
  return useZustandStore(store, selector)
}

/**
 * Raw store handle — `.getState()`, `.setState()`, `.subscribe()`.
 * Use this inside `useFrame` / `useEffect` when you don't want re-renders.
 */
export function useRobotStoreApi() {
  const store = useContext(RobotStoreContext)
  if (!store) {
    throw new Error('useRobotStoreApi must be used inside <RobotStoreProvider>')
  }
  return store
}
