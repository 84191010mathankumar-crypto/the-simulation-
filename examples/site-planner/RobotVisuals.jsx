/**
 * Stylised "real robot" shapes for the site planner.
 *
 * These are NOT the full simulation components from src/lib (URDF arm,
 * animated gantry) — those are fixed-size, built for a small demo room,
 * and far too heavy to instantiate a dozen times next to a 300MB site
 * model. Instead these are simple, clearly-readable robot silhouettes
 * that scale to whatever area the student draws, in the same steel/orange
 * material language as the rest of the project.
 */
import React from 'react'
import * as THREE from 'three'

const steel  = { color: '#2b2d31', metalness: 0.55, roughness: 0.4 }
const accent = { color: '#ff6000', metalness: 0.3, roughness: 0.5 }
const dark   = { color: '#16181b', metalness: 0.5, roughness: 0.55 }

/** A gantry robot scaled to span the given floor rectangle. */
export function GantryRobotVisual({ rect }) {
  const width = Math.max(0.4, rect.maxX - rect.minX)
  const depth = Math.max(0.4, rect.maxZ - rect.minZ)
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2
  const legHeight = THREE.MathUtils.clamp(Math.min(width, depth) * 0.22, 2.4, 4.5)
  const legR = 0.09

  const corners = [
    [rect.minX, rect.minZ],
    [rect.maxX, rect.minZ],
    [rect.minX, rect.maxZ],
    [rect.maxX, rect.maxZ],
  ]

  return (
    <group position={[0, 0, 0]}>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]}>
          <cylinderGeometry args={[legR, legR, legHeight, 12]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}

      {/* Two rails along X, one at each Z end. */}
      {[rect.minZ, rect.maxZ].map((z, i) => (
        <mesh key={i} position={[cx, legHeight, z]}>
          <boxGeometry args={[width + 0.2, 0.12, 0.12]} />
          <meshStandardMaterial {...accent} />
        </mesh>
      ))}

      {/* Bridge spanning Z, parked at the rect's centre. */}
      <mesh position={[cx, legHeight, cz]}>
        <boxGeometry args={[0.16, 0.16, depth + 0.1]} />
        <meshStandardMaterial {...steel} />
      </mesh>

      {/* Trolley + gripper hanging from the bridge's middle. */}
      <mesh position={[cx, legHeight - 0.1, cz]}>
        <boxGeometry args={[0.3, 0.16, 0.3]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <mesh position={[cx, legHeight * 0.62, cz]}>
        <cylinderGeometry args={[0.035, 0.035, legHeight * 0.55, 8]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      <mesh position={[cx, legHeight * 0.34, cz]}>
        <boxGeometry args={[0.22, 0.12, 0.22]} />
        <meshStandardMaterial {...accent} />
      </mesh>
    </group>
  )
}

/** A simple articulated robo-arm silhouette at a single floor point.
 * `valid` controls the base ring colour — green when the placement
 * satisfies the grid/restricted-zone rule, red when it doesn't. */
export function RoboArmVisual({ x, z, valid = true, highlight = false }) {
  const ringColor = valid ? '#10b981' : '#dc2626'
  return (
    <group position={[x, 0, z]}>
      {/* Base pedestal */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.16, 24]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* Column */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.5, 16]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* Shoulder joint */}
      <mesh position={[0, 0.68, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial {...accent} />
      </mesh>
      {/* Upper arm, angled up */}
      <mesh position={[0.18, 0.85, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.13, 0.13]} />
        <meshStandardMaterial {...accent} />
      </mesh>
      {/* Elbow joint */}
      <mesh position={[0.42, 1.06, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial {...dark} />
      </mesh>
      {/* Forearm, angled down toward a work point */}
      <mesh position={[0.64, 0.92, 0]} rotation={[0, 0, Math.PI / 5]}>
        <boxGeometry args={[0.42, 0.1, 0.1]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* Wrist / gripper */}
      <mesh position={[0.86, 0.8, 0]}>
        <boxGeometry args={[0.12, 0.16, 0.16]} />
        <meshStandardMaterial {...dark} />
      </mesh>

      {/* Validity ring on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.3, 0.4, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={highlight ? 0.95 : 0.65} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
