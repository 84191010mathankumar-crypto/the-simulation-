import React, { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  RobotStoreProvider, createRobotStore,
  RobotArm, AnimationController,
  useRobotStore, useRobotStoreApi,
} from '../lib'
import Platform from './Platform.jsx'

/**
 * A single warehouse robot: its own store, mobile platform, KUKA arm, and
 * animation controller.  Bind a store explicitly so the parent component can
 * read/write the same store the inner pipeline consumes (the coordinator
 * needs that handle to drive the state machine).
 *
 * Position the robot at its dock by setting `dock = [x, z]` — that becomes
 * both the initial platform pose and the home pose the arm returns to after
 * a dropoff.
 */
export default function RobotInstance({ store, dock, color }) {
  return (
    <RobotStoreProvider store={store}>
      <RobotRig dock={dock} color={color} />
    </RobotStoreProvider>
  )
}

function RobotRig({ dock, color }) {
  const baseRef = useRef()
  const storeApi = useRobotStoreApi()
  const setPlatformGroupRef = useRobotStore((s) => s.setPlatformGroupRef)

  // One-time setup: park the robot at its dock and tell the store this is
  // home so `returning` sends it back here, not to world origin.
  useEffect(() => {
    const home = { position: [dock[0], 0, dock[1]], rotation: [0, 0, 0] }
    storeApi.setState({
      mobileMode:   true,
      platformPose: home,
      platformHome: home,
    })
  }, [storeApi, dock])

  // Register the group with the store so the IK solver can probe future
  // platform poses (same plumbing as the single-arm demo's RobotBase).
  useEffect(() => {
    setPlatformGroupRef(baseRef.current || null)
    return () => setPlatformGroupRef(null)
  }, [setPlatformGroupRef])

  // Drive the THREE.Group transform from platformPose every frame.
  useFrame(() => {
    const g = baseRef.current
    if (!g) return
    const p = storeApi.getState().platformPose
    if (!p) return
    g.position.set(p.position[0], p.position[1], p.position[2])
    g.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2])
  })

  return (
    <group ref={baseRef}>
      <Platform accentColor={color} />
      <RobotArm parentRef={baseRef} mountY={0.235} />
      <AnimationController />
    </group>
  )
}

/** Convenience hook to build the per-robot data structure the coordinator
 *  expects: { id, store, dock, color }.  Stores are created once and
 *  preserved across slider changes, so robots keep their state. */
export function useRobotInstances(docks) {
  return useMemo(
    () => docks.map((d) => ({
      id:    d.id,
      store: createRobotStore(),
      dock:  d.position,
      color: d.color,
    })),
    [docks],
  )
}
