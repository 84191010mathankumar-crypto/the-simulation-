import React, { useMemo } from 'react'
import * as THREE from 'three'
import { WORKING_AREA } from '../state/useStore'

/**
 * Visualises the KR210 R2700-2 working envelope as a transparent cylinder
 * representing the approximate reachable workspace.
 * Also draws an axis indicator at the robot base.
 */
export default function WorkingEnvelope() {
  const { radius, minZ, maxZ } = WORKING_AREA
  const height = maxZ - minZ
  const centerY = minZ + height / 2

  // Dashed ring at max reach
  const ringGeom = useMemo(() => {
    const points = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [radius])

  return (
    <group>
      {/* Envelope cylinder */}
      <mesh position={[0, centerY, 0]} renderOrder={-1}>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true]} />
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Top ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, maxZ, 0]}>
        <ringGeometry args={[radius - 0.01, radius + 0.01, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Bottom ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, minZ, 0]}>
        <ringGeometry args={[radius - 0.01, radius + 0.01, 64]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Reach circle on floor */}
      <lineLoop geometry={ringGeom} position={[0, 0.002, 0]}>
        <lineBasicMaterial color="#3b82f6" transparent opacity={0.3} />
      </lineLoop>

      {/* Robot base marker */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.16, 32]} />
        <meshBasicMaterial color="#f0a500" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Base axes */}
      <axesHelper args={[0.3]} position={[0, 0.01, 0]} />
    </group>
  )
}
