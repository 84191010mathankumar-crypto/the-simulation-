import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import useGantryStore, { RAIL_Y } from './useGantryStore'

// Default frame footprint — how far the rails/bridge reach in each direction.
// Can be overridden via <GantryRobot travelX=.. travelZ=.. /> to span a larger
// area (e.g. the whole warehouse floor).
export const DEFAULT_TRAVEL_X = 1.85
export const DEFAULT_TRAVEL_Z = 1.35
// Back-compat aliases for the gantry example which imports the old names.
export const TRAVEL_X = DEFAULT_TRAVEL_X
export const TRAVEL_Z = DEFAULT_TRAVEL_Z

// Distance from the gripper's mast attachment point down to the fingertips
// (its actual pinch point) — the mast has to fall short by this much so the
// fingertips, not the gripper's mounting block, land exactly on `pose.y`.
const GRIPPER_HEIGHT = 0.20

const steel    = { color: '#2b2d31', metalness: 0.55, roughness: 0.4 }
const accent   = { color: '#ff6000', metalness: 0.3,  roughness: 0.5 }
const dark     = { color: '#16181b', metalness: 0.5,  roughness: 0.55 }
const rubberMat = { color: '#111316', metalness: 0.1, roughness: 0.85 }

function Leg({ x, z }) {
  return (
    <mesh castShadow receiveShadow position={[x, RAIL_Y / 2, z]}>
      <boxGeometry args={[0.12, RAIL_Y, 0.12]} />
      <meshStandardMaterial {...steel} />
    </mesh>
  )
}

/** Static frame: 4 legs + 2 rails the bridge travels along. */
function GantryFrame({ travelX, travelZ }) {
  const railLen = travelX * 2 + 0.3
  // Scale leg/rail thickness with the frame span so a warehouse-wide gantry
  // doesn't look like a toothpick frame.
  const t = Math.max(0.12, Math.min(0.4, travelX * 0.06))
  return (
    <group>
      <Leg x={-travelX} z={-travelZ} />
      <Leg x={ travelX} z={-travelZ} />
      <Leg x={-travelX} z={ travelZ} />
      <Leg x={ travelX} z={ travelZ} />

      <mesh castShadow receiveShadow position={[0, RAIL_Y, -travelZ]}>
        <boxGeometry args={[railLen, t, t]} />
        <meshStandardMaterial {...accent} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, RAIL_Y, travelZ]}>
        <boxGeometry args={[railLen, t, t]} />
        <meshStandardMaterial {...accent} />
      </mesh>
    </group>
  )
}

/** Two-finger parallel gripper, same idea as the arm's gripper but plainer. */
function Gripper({ gripperRef, leftFingerRef, rightFingerRef }) {
  return (
    <group ref={gripperRef}>
      <mesh castShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[0.16, 0.1, 0.16]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <mesh ref={leftFingerRef} castShadow position={[-0.05, -0.14, 0]}>
        <boxGeometry args={[0.025, 0.12, 0.09]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>
      <mesh ref={rightFingerRef} castShadow position={[0.05, -0.14, 0]}>
        <boxGeometry args={[0.025, 0.12, 0.09]} />
        <meshStandardMaterial {...rubberMat} />
      </mesh>
    </group>
  )
}

/**
 * The gantry's moving parts: bridge slides along X, trolley slides along Z
 * on the bridge, the mast telescopes down/up (Y), and the gripper at the
 * bottom of the mast spins about the vertical axis.
 *
 * `pose.{x,y,z,rotY}` in the store is the gripper TIP position directly —
 * there's no inverse kinematics step, the numbers are the position.
 */
export default function GantryRobot({ travelX = DEFAULT_TRAVEL_X, travelZ = DEFAULT_TRAVEL_Z }) {
  const bridgeRef  = useRef()
  const trolleyRef = useRef()
  const mastRef    = useRef()
  const gripperRef = useRef()
  const leftFingerRef  = useRef()
  const rightFingerRef = useRef()
  const fingerOffsetRef = useRef(0.05)

  useFrame((_, delta) => {
    const { pose, gripperOpen } = useGantryStore.getState()
    if (bridgeRef.current)  bridgeRef.current.position.x = pose.x
    if (trolleyRef.current) trolleyRef.current.position.z = pose.z

    const mastLen = Math.max(0.05, RAIL_Y - GRIPPER_HEIGHT - pose.y)
    if (mastRef.current) {
      mastRef.current.scale.y = mastLen
      mastRef.current.position.y = -mastLen / 2
    }
    if (gripperRef.current) {
      gripperRef.current.position.y = -mastLen
      gripperRef.current.rotation.y = pose.rotY
    }

    const target = gripperOpen ? 0.05 : 0.018
    fingerOffsetRef.current += (target - fingerOffsetRef.current) * Math.min(1, delta * 10)
    if (leftFingerRef.current)  leftFingerRef.current.position.x  = -fingerOffsetRef.current
    if (rightFingerRef.current) rightFingerRef.current.position.x =  fingerOffsetRef.current
  })

  const beamDepth = travelZ * 2 + 0.2
  return (
    <group>
      <GantryFrame travelX={travelX} travelZ={travelZ} />
      <group ref={bridgeRef}>
        <mesh castShadow receiveShadow position={[0, RAIL_Y, 0]}>
          <boxGeometry args={[0.16, 0.16, beamDepth]} />
          <meshStandardMaterial {...steel} />
        </mesh>
        <group ref={trolleyRef} position={[0, RAIL_Y, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.16, 0.3]} />
            <meshStandardMaterial {...dark} />
          </mesh>
          <mesh ref={mastRef} castShadow position={[0, -0.5, 0]}>
            <boxGeometry args={[0.09, 1, 0.09]} />
            <meshStandardMaterial {...steel} />
          </mesh>
          <Gripper gripperRef={gripperRef} leftFingerRef={leftFingerRef} rightFingerRef={rightFingerRef} />
        </group>
      </group>
    </group>
  )
}
