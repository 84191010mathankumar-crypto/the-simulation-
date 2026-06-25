/**
 * Panel wall target tool.
 *
 * Unplaced segments → floor outline only (chalk-line style).
 * Placed segments   → solid wall (panel delivered by robot).
 * Active drawing    → preview wall follows the cursor, axis-locked and
 *                     snapped to whole panel-size multiples.
 */
import React, { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'

const PANEL_HEIGHT    = 1.5
const PANEL_THICKNESS = 0.1
const SNAP            = 0.5   // anchor snaps to 0.5 m grid

const _raycaster   = new THREE.Raycaster()
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit         = new THREE.Vector3()

function groundPointFromEvent(e, camera, dom) {
  const rect = dom.getBoundingClientRect()
  _raycaster.setFromCamera({
    x:  ((e.clientX - rect.left) / rect.width)  * 2 - 1,
    y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
  }, camera)
  if (!_raycaster.ray.intersectPlane(_groundPlane, _hit)) return null
  return [_hit.x, _hit.z]
}

function snapAnchor(p) {
  return [Math.round(p[0] / SNAP) * SNAP, Math.round(p[1] / SNAP) * SNAP]
}

// Axis-lock + snap length to whole panel-size multiples.
function computeWall(start, current, panelSize) {
  const dx = current[0] - start[0]
  const dz = current[1] - start[1]
  if (Math.abs(dx) >= Math.abs(dz)) {
    const count = Math.round(Math.abs(dx) / panelSize)
    const dir   = dx >= 0 ? 1 : -1
    return { end: [start[0] + dir * count * panelSize, start[1]], axis: 'x', count }
  } else {
    const count = Math.round(Math.abs(dz) / panelSize)
    const dir   = dz >= 0 ? 1 : -1
    return { end: [start[0], start[1] + dir * count * panelSize], axis: 'z', count }
  }
}

// Individual panel segment centres along a wall run.
export function getSegments(wall) {
  const { x1, z1, x2, z2, size = 2 } = wall
  const axis = wall.axis || (Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? 'x' : 'z')
  if (axis === 'x') {
    const count = Math.max(1, Math.round(Math.abs(x2 - x1) / size))
    const dir   = x2 >= x1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1 + dir * (i + 0.5) * size, cz: z1, axis: 'x',
    }))
  } else {
    const count = Math.max(1, Math.round(Math.abs(z2 - z1) / size))
    const dir   = z2 >= z1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1, cz: z1 + dir * (i + 0.5) * size, axis: 'z',
    }))
  }
}

// ── Solid wall segment (panel has been placed by robot) ──────────────────────
function PlacedSegment({ cx, cz, axis, size, selected, hovered }) {
  const w = axis === 'x' ? size : PANEL_THICKNESS
  const d = axis === 'z' ? size : PANEL_THICKNESS
  const color = selected ? '#60a5fa' : hovered ? '#93c5fd' : '#e2e8f0'
  return (
    <group position={[cx, PANEL_HEIGHT / 2, cz]}>
      <mesh>
        <boxGeometry args={[w, PANEL_HEIGHT, d]} />
        <meshStandardMaterial color={color} metalness={0.1} roughness={0.55}
          transparent opacity={selected ? 0.95 : 0.88} />
        <Edges color={selected ? '#3b82f6' : '#94a3b8'} />
      </mesh>
    </group>
  )
}

// ── Target outline (panel not yet placed) ────────────────────────────────────
function TargetSegment({ cx, cz, axis, size, preview }) {
  const w = axis === 'x' ? size : PANEL_THICKNESS
  const d = axis === 'z' ? size : PANEL_THICKNESS
  return (
    <group>
      {/* Floor stripe */}
      <mesh position={[cx, 0.02, cz]}>
        <boxGeometry args={[w, 0.04, d]} />
        <meshBasicMaterial color="#0891b2" transparent opacity={preview ? 0.4 : 0.75}
          depthWrite={false} />
      </mesh>
      {/* Wireframe ghost of where the wall will stand */}
      <group position={[cx, PANEL_HEIGHT / 2, cz]}>
        <mesh>
          <boxGeometry args={[w, PANEL_HEIGHT, d]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color="#0891b2" />
        </mesh>
      </group>
    </group>
  )
}

// ── One drawn wall run ────────────────────────────────────────────────────────
function PanelWall({ panel, selected, preview, placedKeys, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const size     = panel.size || 2
  const segments = getSegments(panel)
  if (segments.length === 0) return null

  const mid = segments[Math.floor(segments.length / 2)]

  function handleDown(e) {
    if (preview || !onSelect) return
    e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const up = (ev) => {
      window.removeEventListener('pointerup', up)
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) onSelect()
    }
    window.addEventListener('pointerup', up)
  }

  return (
    <group
      onPointerDown={handleDown}
      onPointerEnter={preview ? undefined : () => setHovered(true)}
      onPointerLeave={preview ? undefined : () => setHovered(false)}
    >
      {segments.map((seg, i) => {
        const segKey = `${panel.id}-${i}`
        const placed = !preview && placedKeys && placedKeys.has(segKey)
        return placed
          ? <PlacedSegment key={i} cx={seg.cx} cz={seg.cz} axis={seg.axis} size={size}
              selected={selected} hovered={hovered} />
          : <TargetSegment key={i} cx={seg.cx} cz={seg.cz} axis={seg.axis} size={size}
              preview={preview} />
      })}

      {selected && !preview && onDelete && (
        <Html center position={[mid.cx, PANEL_HEIGHT / 2 + 0.35, mid.cz]}
          style={{ pointerEvents: 'all' }} zIndexRange={[100, 0]}>
          <button
            onPointerDown={(e) => {
              e.stopPropagation()
              const sx = e.clientX, sy = e.clientY
              const up = (ev) => {
                window.removeEventListener('pointerup', up)
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) onDelete()
              }
              window.addEventListener('pointerup', up)
            }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#dc2626', border: '2px solid #fff', color: '#fff',
              cursor: 'pointer', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)', padding: 0,
            }}
          >−</button>
        </Html>
      )}
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function LineTool({
  active, items = [], selectedId, groundSize, panelSize = 2,
  placedSegmentIds,   // Set<"runId-segIdx"> of panels delivered by robots
  selectable = true,
  onCreate, onSelect, onDelete, onDeselect,
}) {
  const { camera, gl } = useThree()
  const [firstPoint, setFirstPoint] = useState(null)
  const [wall, setWall]             = useState(null)

  useEffect(() => {
    if (!active) { setFirstPoint(null); setWall(null) }
  }, [active])

  useEffect(() => {
    const dom = gl.domElement
    function handleMove(e) {
      if (!active || !firstPoint) return
      const p = groundPointFromEvent(e, camera, dom)
      if (p) setWall(computeWall(firstPoint, p, panelSize))
    }
    dom.addEventListener('pointermove', handleMove)
    return () => dom.removeEventListener('pointermove', handleMove)
  }, [active, firstPoint, camera, gl, panelSize])

  function handleFloorDown(e) {
    if (!active) { onDeselect(); return }
    e.stopPropagation()
    const snapped = snapAnchor([e.point.x, e.point.z])
    if (!firstPoint) {
      setFirstPoint(snapped)
      setWall({ end: snapped, axis: 'x', count: 0 })
      return
    }
    const w = computeWall(firstPoint, snapped, panelSize)
    if (w.count >= 1) {
      onCreate({
        x1: firstPoint[0], z1: firstPoint[1],
        x2: w.end[0],      z2: w.end[1],
        axis: w.axis,       size: panelSize,
      })
    }
    setFirstPoint(null)
    setWall(null)
  }

  return (
    <group>
      {/* Invisible floor hit target */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}
        onPointerDown={handleFloorDown}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {items.map((it) => (
        <PanelWall
          key={it.id}
          panel={it}
          selected={it.id === selectedId}
          placedKeys={placedSegmentIds}
          onSelect={!active && selectable ? () => onSelect(it.id) : null}
          onDelete={onDelete ? () => onDelete(it.id) : null}
        />
      ))}

      {/* Anchor dot at first click */}
      {active && firstPoint && (
        <mesh position={[firstPoint[0], 0.12, firstPoint[1]]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#0891b2" />
        </mesh>
      )}

      {/* Preview while drawing */}
      {active && firstPoint && wall && wall.count >= 1 && (
        <PanelWall
          panel={{
            id: '__preview__',
            x1: firstPoint[0], z1: firstPoint[1],
            x2: wall.end[0],   z2: wall.end[1],
            axis: wall.axis,   size: panelSize,
          }}
          preview
        />
      )}
    </group>
  )
}
