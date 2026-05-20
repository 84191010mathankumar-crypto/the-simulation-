import React from 'react'

/**
 * Slightly chunkier AGV chassis suited to the warehouse scene.  Same look as
 * the single-arm demo's MobilePlatform but with a colour-tinted disc so each
 * robot is easy to distinguish in a crowded scene.
 */
export default function Platform({ accentColor = '#ff6000' }) {
  return (
    <group>
      {/* Chassis */}
      <mesh receiveShadow castShadow position={[0, 0.10, 0]}>
        <boxGeometry args={[1.10, 0.18, 0.80]} />
        <meshStandardMaterial color="#2b2d31" metalness={0.55} roughness={0.40} />
      </mesh>
      {/* Top trim strip */}
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[1.105, 0.005, 0.805]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* 4 wheels */}
      {[
        [-0.48,  0.34],
        [ 0.48,  0.34],
        [-0.48, -0.34],
        [ 0.48, -0.34],
      ].map((p, i) => (
        <mesh key={i} position={[p[0], 0.06, p[1]]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.07, 24]} />
          <meshStandardMaterial color="#111316" metalness={0.4} roughness={0.55} />
        </mesh>
      ))}
      {/* Robot mounting disc — coloured per robot */}
      <mesh receiveShadow castShadow position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.30, 0.32, 0.025, 32]} />
        <meshStandardMaterial color={accentColor} metalness={0.30} roughness={0.50} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        const r = 0.275
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.224, Math.sin(a) * r]} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.007, 8]} />
            <meshStandardMaterial color="#1a1c20" metalness={0.8} roughness={0.3} />
          </mesh>
        )
      })}
      {/* Front LiDAR / sensor tower */}
      <mesh castShadow position={[0.50, 0.23, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
        <meshStandardMaterial color="#0e1014" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0.50, 0.27, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
        <meshStandardMaterial color="#3b6fff" metalness={0.3} roughness={0.4} emissive="#3b6fff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}
