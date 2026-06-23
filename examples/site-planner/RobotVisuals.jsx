import React, { useMemo } from 'react'
import * as THREE from 'three'

const steel  = { color: '#2b2d31', metalness: 0.55, roughness: 0.4 }
const accent = { color: '#ff6000', metalness: 0.3, roughness: 0.5 }
const dark   = { color: '#16181b', metalness: 0.5, roughness: 0.55 }

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
    <group>
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]}>
          <cylinderGeometry args={[legR, legR, legHeight, 12]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      {[rect.minZ, rect.maxZ].map((z, i) => (
        <mesh key={i} position={[cx, legHeight, z]}>
          <boxGeometry args={[width + 0.2, 0.12, 0.12]} />
          <meshStandardMaterial {...accent} />
        </mesh>
      ))}
      <mesh position={[cx, legHeight, cz]}>
        <boxGeometry args={[0.16, 0.16, depth + 0.1]} />
        <meshStandardMaterial {...steel} />
      </mesh>
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

/** Grid pattern lines rendered inside a grid area at unit intervals. */
export function GridAreaVisual({ rect, gridSizeCm = 100 }) {
  const geom = useMemo(() => {
    const unit = gridSizeCm / 100
    const verts = []
    const y = 0.06
    for (let x = rect.minX; x <= rect.maxX + 0.001; x += unit) {
      const cx = Math.min(x, rect.maxX)
      verts.push(cx, y, rect.minZ, cx, y, rect.maxZ)
    }
    for (let z = rect.minZ; z <= rect.maxZ + 0.001; z += unit) {
      const cz = Math.min(z, rect.maxZ)
      verts.push(rect.minX, y, cz, rect.maxX, y, cz)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    return g
  }, [rect.minX, rect.maxX, rect.minZ, rect.maxZ, gridSizeCm])

  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#3b82f6" opacity={0.55} transparent />
    </lineSegments>
  )
}

const STACK_LAYERS = 3

/** Stacked unit cubes (x=y=z=unit) filling a storage area. */
export function StorageVisual({ rect, gridSizeCm = 60 }) {
  const boxes = useMemo(() => {
    const unit = gridSizeCm / 100
    const side = unit * 0.88   // slight gap between cubes, same on all axes
    const w = rect.maxX - rect.minX
    const d = rect.maxZ - rect.minZ
    const cols = Math.min(14, Math.max(1, Math.floor(w / unit)))
    const rows = Math.min(14, Math.max(1, Math.floor(d / unit)))
    const stepX = w / cols
    const stepZ = d / rows
    const result = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        for (let h = 0; h < STACK_LAYERS; h++) {
          result.push({
            key: `${c}-${r}-${h}`,
            x: rect.minX + (c + 0.5) * stepX,
            y: (h + 0.5) * unit + 0.02,
            z: rect.minZ + (r + 0.5) * stepZ,
            side,
          })
        }
      }
    }
    return result
  }, [rect.minX, rect.maxX, rect.minZ, rect.maxZ, gridSizeCm])

  return (
    <group>
      {boxes.map(({ key, x, y, z, side }) => (
        <mesh key={key} position={[x, y, z]}>
          <boxGeometry args={[side, side, side]} />
          <meshStandardMaterial color="#92400e" metalness={0.05} roughness={0.88} />
        </mesh>
      ))}
    </group>
  )
}
