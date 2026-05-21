/**
 * React context that lets `<RobotArm>`, `<AnimationController>` and
 * `<WorkObject>` find the per-instance zustand store they should bind to.
 *
 * Usage:
 *
 *   const myStore = createRobotStore()        // one per robot
 *   <RobotStoreProvider store={myStore}>
 *     <RobotArm />
 *     <AnimationController />
 *   </RobotStoreProvider>
 *
 * When no provider wraps the tree, components fall back to the library
 * singleton from ./useStore — this is exactly how the main single-robot
 * demo keeps working without changes.
 */
import React, { createContext, useContext } from 'react'
import defaultStore from './useStore'

const RobotStoreContext = createContext(defaultStore)

export function RobotStoreProvider({ store, children }) {
  return (
    <RobotStoreContext.Provider value={store}>
      {children}
    </RobotStoreContext.Provider>
  )
}

// Returns the zustand store hook fn for the current robot.  Call as a hook
// (`useThisStore(s => s.x)`) or use its statics (`.getState()`, `.setState()`,
// `.subscribe()`).
export function useRobotStore() {
  return useContext(RobotStoreContext)
}
