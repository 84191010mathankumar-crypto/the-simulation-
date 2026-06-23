/**
 * A KUKA arm riding an AGV chassis, driven by a per-robot store.
 *
 * Extracted from WarehouseScene so both the warehouse demo and the
 * site-planner simulation share one mobile-robot visual.  The outer group is
 * driven each frame from the store's `platformPose` (written by the lib's
 * AnimationController), and the arm itself is the unmodified lib <RobotArm>.
 */
import React, { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RobotArm } from 'robo-playground'

/* AGV chassis — same look as the main demo's MobilePlatform. */
export function MobilePlatform() {
  return (
    <group>
      <mesh receiveShadow castShadow position={[0, 0.10, 0]}>
        <boxGeometry args={[1.10, 0.18, 0.80]} />
        <meshStandardMaterial color="#2b2d31" metalness={0.55} roughness={0.40} />
      </mesh>
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[1.105, 0.005, 0.805]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.5} roughness={0.55} />
      </mesh>
      {[[-0.48, 0.34],[0.48, 0.34],[-0.48,-0.34],[0.48,-0.34]].map((p,i)=>(
        <mesh key={i} position={[p[0],0.06,p[1]]} rotation={[0,0,Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.075,0.075,0.07,24]} />
          <meshStandardMaterial color="#111316" metalness={0.4} roughness={0.55} />
        </mesh>
      ))}
      <mesh receiveShadow castShadow position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.30, 0.32, 0.025, 32]} />
        <meshStandardMaterial color="#ff6000" metalness={0.30} roughness={0.50} />
      </mesh>
    </group>
  )
}

/* Drives a robot's outer group from its store's platformPose, and mounts the
 * lib <RobotArm> on top of the AGV.  A coloured ring under the chassis makes
 * different robots easy to tell apart. */
export default function MobileArmRobot({ store, robotColor = '#ff6000', mountY = 0.235 }) {
  const baseRef = useRef()
  const setPlatformGroupRef = store((s) => s.setPlatformGroupRef)

  useEffect(() => {
    setPlatformGroupRef(baseRef.current || null)
    return () => setPlatformGroupRef(null)
  }, [setPlatformGroupRef])

  useFrame(() => {
    const g = baseRef.current
    if (!g) return
    const p = store.getState().platformPose
    g.position.set(p.position[0], p.position[1], p.position[2])
    g.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2])
  })

  return (
    <group ref={baseRef}>
      <MobilePlatform />
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.65, 0.78, 32]} />
        <meshBasicMaterial color={robotColor} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <RobotArm parentRef={baseRef} mountY={mountY} />
    </group>
  )
}
