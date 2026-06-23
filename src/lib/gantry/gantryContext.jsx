/**
 * React context that lets `<GantryRobot>`, `<GantryAnimationController>` and
 * `<GantryCarriedObject>` find the per-instance zustand store they should
 * bind to — the gantry-side twin of state/context.jsx for the arm.
 *
 * Usage:
 *
 *   const myStore = createGantryStore()        // one per gantry
 *   <GantryStoreProvider store={myStore}>
 *     <GantryRobot travelX=.. travelZ=.. />
 *     <GantryAnimationController />
 *   </GantryStoreProvider>
 *
 * With no provider, components fall back to the library singleton from
 * ./useGantryStore — exactly how the single-gantry demo keeps working.
 */
import React, { createContext, useContext } from 'react'
import defaultGantryStore from './useGantryStore'

const GantryStoreContext = createContext(defaultGantryStore)

export function GantryStoreProvider({ store, children }) {
  return (
    <GantryStoreContext.Provider value={store}>
      {children}
    </GantryStoreContext.Provider>
  )
}

// Returns the zustand store hook fn for the current gantry.  Use its statics
// (`.getState()`, `.setState()`, `.subscribe()`) or call it as a hook.
export function useGantryRobotStore() {
  return useContext(GantryStoreContext)
}
