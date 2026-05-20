import React, { useMemo } from 'react'
import * as THREE from 'three'

/**
 * 20×20 m warehouse room — polished concrete floor, low charcoal walls,
 * subtle painted lane markings.  Visuals tuned to match the single-arm
 * demo's neutral cool palette (no warm tint).
 */
export default function Room({ size = 20 }) {
  const half = size / 2
  const wallH = 0.50

  const laneGeom = useMemo(() => {
    const inner = size * 0.4
    const points = [
      [-inner, 0, -inner], [ inner, 0, -inner],
      [ inner, 0,  inner], [-inner, 0,  inner],
      [-inner, 0, -inner],
    ].map((p) => new THREE.Vector3(...p))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [size])

  return (
    <group>
      {/* Floor — slightly cooler than the panel bg so the robots pop */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#dde2ea"
          metalness={0.05}
          roughness={0.85}
        />
      </mesh>

      {/* 4 low walls — open-top warehouse feel */}
      {[
        [ 0, wallH / 2, -half, size,  wallH, 0.10],   // back
        [ 0, wallH / 2,  half, size,  wallH, 0.10],   // front
        [-half, wallH / 2, 0,  0.10,  wallH, size],   // left
        [ half, wallH / 2, 0,  0.10,  wallH, size],   // right
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} receiveShadow castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color="#3a3d44"
            metalness={0.45}
            roughness={0.50}
          />
        </mesh>
      ))}

      {/* Painted lane outline on the floor */}
      <lineLoop geometry={laneGeom} position={[0, 0.002, 0]}>
        <lineBasicMaterial color="#8a93a3" transparent opacity={0.35} />
      </lineLoop>

      {/* Centre cross */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size * 0.005, size * 0.04]} />
        <meshBasicMaterial color="#8a93a3" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[size * 0.005, size * 0.04]} />
        <meshBasicMaterial color="#8a93a3" transparent opacity={0.45} />
      </mesh>
    </group>
  )
}

/**
 * Outlined drop-zone marker.  Sized slightly larger than the box so the box
 * has visible margin when it lands.
 */
export function TargetZone({ position, size, color }) {
  const w = size[0] * 1.5
  const d = size[2] * 1.5

  const outline = useMemo(() => {
    const hx = w / 2, hd = d / 2
    const pts = [
      [-hx, 0, -hd], [ hx, 0, -hd],
      [ hx, 0,  hd], [-hx, 0,  hd],
      [-hx, 0, -hd],
    ].map((p) => new THREE.Vector3(...p))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [w, d])

  return (
    <group position={[position[0], 0.004, position[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      <lineLoop geometry={outline}>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </lineLoop>
    </group>
  )
}
