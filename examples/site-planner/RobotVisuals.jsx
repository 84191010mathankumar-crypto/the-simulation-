import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { sourceKey } from './simulation'

const steel  = { color: '#2b2d31', metalness: 0.55, roughness: 0.4 }
const accent = { color: '#ff6000', metalness: 0.3, roughness: 0.5 }
const dark   = { color: '#16181b', metalness: 0.5, roughness: 0.55 }

/**
 * Evenly distribute support stations along a rail of length `span`, targeting
 * roughly `spacing` metres between them and always including both ends.  End
 * gaps equal interior gaps — e.g. an 18 m rail at spacing=10 gives stations at
 * 0, 9, 18 m rather than 0, 10, 18 m.
 */
function pillarStations(span, spacing = 6) {
  const n = Math.max(1, Math.round(span / spacing))
  const out = []
  for (let i = 0; i <= n; i++) out.push((i / n) * span)
  return out
}

export function GantryRobotVisual({ rect, pillarSpacing = 6 }) {
  const width = Math.max(0.4, rect.maxX - rect.minX)
  const depth = Math.max(0.4, rect.maxZ - rect.minZ)
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2
  const legHeight = THREE.MathUtils.clamp(Math.min(width, depth) * 0.22, 2.4, 4.5)
  const legR = 0.09

  // Pillar X positions along the long rails (which run along X at the two Z
  // edges).  Distributed evenly with ~6 m bays, both ends included.
  const xStations = pillarStations(width, pillarSpacing).map((p) => rect.minX + p)

  return (
    <group>
      {/* Pillars down each long rail (left & right sides). */}
      {xStations.map((x, i) => (
        <mesh key={`l-${i}`} position={[x, legHeight / 2, rect.minZ]}>
          <cylinderGeometry args={[legR, legR, legHeight, 12]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      {xStations.map((x, i) => (
        <mesh key={`r-${i}`} position={[x, legHeight / 2, rect.maxZ]}>
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
    <group>
      {/* Very transparent black background. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(rect.minX + rect.maxX) / 2, 0.055, (rect.minZ + rect.maxZ) / 2]}>
        <planeGeometry args={[rect.maxX - rect.minX, rect.maxZ - rect.minZ]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.02} depthWrite={false} />
      </mesh>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#3b3f44" opacity={0.3} transparent />
      </lineSegments>
    </group>
  )
}

const STACK_LAYERS = 3
const _dummy = new THREE.Object3D()

/**
 * Stacked unit cubes (x=y=z=unit) filling a storage area.
 *
 * Rendered as a single instanced mesh — a full storage area can hold up to
 * 14×14×3 ≈ 588 cubes, and one instanced draw call instead of ~600 separate
 * meshes is what keeps the site (and, by the same token, the warehouse) from
 * crawling once a few storage areas are on the floor.
 *
 * `hiddenKeys` (a Set of sourceKey()s) lists storage cubes that have been
 * handed to the simulation — i.e. they're now represented by a moving SimBox,
 * so we skip them here.  As the arms/gantries carry those boxes off, the pile
 * visibly depletes instead of staying eternally full.
 */
export function StorageVisual({ rect, gridSizeCm = 60, hiddenKeys = null }) {
  const { positions, side } = useMemo(() => {
    const unit = gridSizeCm / 100
    const sd = unit * 0.88   // slight gap between cubes, same on all axes
    const w = rect.maxX - rect.minX
    const d = rect.maxZ - rect.minZ
    const cols = Math.min(14, Math.max(1, Math.floor(w / unit)))
    const rows = Math.min(14, Math.max(1, Math.floor(d / unit)))
    const stepX = w / cols
    const stepZ = d / rows
    const out = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        for (let h = 0; h < STACK_LAYERS; h++) {
          out.push([
            rect.minX + (c + 0.5) * stepX,
            (h + 0.5) * unit + 0.02,
            rect.minZ + (r + 0.5) * stepZ,
          ])
        }
      }
    }
    return { positions: out, side: sd }
  }, [rect.minX, rect.maxX, rect.minZ, rect.maxZ, gridSizeCm])

  const visible = useMemo(
    () => (hiddenKeys && hiddenKeys.size ? positions.filter((p) => !hiddenKeys.has(sourceKey(p))) : positions),
    [positions, hiddenKeys]
  )

  const ref = useRef()
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < visible.length; i++) {
      _dummy.position.set(visible[i][0], visible[i][1], visible[i][2])
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.set(1, 1, 1)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.count = visible.length
    mesh.instanceMatrix.needsUpdate = true
  }, [visible])

  if (positions.length === 0) return null

  return (
    <instancedMesh
      key={positions.length}
      ref={ref}
      args={[undefined, undefined, positions.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[side, side, side]} />
      <meshStandardMaterial color="#92400e" metalness={0.05} roughness={0.88} />
    </instancedMesh>
  )
}
