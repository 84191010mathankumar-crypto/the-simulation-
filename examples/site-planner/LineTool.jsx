import React, { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'

const PANEL_HEIGHT = 1.5
const PANEL_THICKNESS = 0.1
const SNAP = 0.5  // anchor snaps to 0.5 m grid

const _raycaster = new THREE.Raycaster()
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit = new THREE.Vector3()

function groundPointFromEvent(e, camera, dom) {
  const rect = dom.getBoundingClientRect()
  const ndc = {
    x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
  }
  _raycaster.setFromCamera(ndc, camera)
  if (!_raycaster.ray.intersectPlane(_groundPlane, _hit)) return null
  return [_hit.x, _hit.z]
}

function snapAnchor(p) {
  return [Math.round(p[0] / SNAP) * SNAP, Math.round(p[1] / SNAP) * SNAP]
}

// Axis-locks and snaps length to whole panel-size multiples.
// Returns { end: [x, z], axis: 'x'|'z', count }
function computeWall(start, current, panelSize) {
  const dx = current[0] - start[0]
  const dz = current[1] - start[1]
  if (Math.abs(dx) >= Math.abs(dz)) {
    const count = Math.round(Math.abs(dx) / panelSize)
    const dir = dx >= 0 ? 1 : -1
    return { end: [start[0] + dir * count * panelSize, start[1]], axis: 'x', count }
  } else {
    const count = Math.round(Math.abs(dz) / panelSize)
    const dir = dz >= 0 ? 1 : -1
    return { end: [start[0], start[1] + dir * count * panelSize], axis: 'z', count }
  }
}

// Centre positions of every individual panel segment along a wall.
function getSegments(wall) {
  const { x1, z1, x2, z2, size = 2 } = wall
  // Derive axis from stored value or from line direction (backward compat).
  const axis = wall.axis || (Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? 'x' : 'z')
  if (axis === 'x') {
    const count = Math.max(1, Math.round(Math.abs(x2 - x1) / size))
    const dir = x2 >= x1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1 + dir * (i + 0.5) * size,
      cz: z1,
      axis: 'x',
    }))
  } else {
    const count = Math.max(1, Math.round(Math.abs(z2 - z1) / size))
    const dir = z2 >= z1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1,
      cz: z1 + dir * (i + 0.5) * size,
      axis: 'z',
    }))
  }
}

function PanelSegment({ cx, cz, axis, size, color, opacity, edgeColor, preview }) {
  const w = axis === 'x' ? size : PANEL_THICKNESS
  const d = axis === 'z' ? size : PANEL_THICKNESS
  return (
    <group position={[cx, PANEL_HEIGHT / 2, cz]}>
      <mesh>
        <boxGeometry args={[w, PANEL_HEIGHT, d]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={!preview} />
        <Edges color={edgeColor} />
      </mesh>
    </group>
  )
}

function PanelWall({ panel, selected, preview, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const size = panel.size || 2
  const segments = getSegments(panel)
  if (segments.length === 0) return null

  const color   = selected ? '#60a5fa' : hovered ? '#93c5fd' : '#94a3b8'
  const opacity = preview ? 0.42 : selected ? 0.92 : hovered ? 0.82 : 0.72
  const edgeCol = selected ? '#3b82f6' : preview ? '#94a3b8' : '#64748b'

  // Pick the middle segment for the delete button anchor.
  const mid = segments[Math.floor(segments.length / 2)]

  function handlePointerDown(e) {
    if (preview || !onSelect) return
    e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const onUp = (ev) => {
      window.removeEventListener('pointerup', onUp)
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) onSelect()
    }
    window.addEventListener('pointerup', onUp)
  }

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerEnter={preview ? undefined : () => setHovered(true)}
      onPointerLeave={preview ? undefined : () => setHovered(false)}
    >
      {segments.map((seg, i) => (
        <PanelSegment
          key={i}
          cx={seg.cx} cz={seg.cz} axis={seg.axis} size={size}
          color={color} opacity={opacity} edgeColor={edgeCol} preview={preview}
        />
      ))}

      {selected && !preview && onDelete && (
        <Html
          center
          position={[mid.cx, PANEL_HEIGHT / 2 + 0.35, mid.cz]}
          style={{ pointerEvents: 'all' }}
          zIndexRange={[100, 0]}
        >
          <button
            onPointerDown={(e) => {
              e.stopPropagation()
              const sx = e.clientX, sy = e.clientY
              const onUp = (ev) => {
                window.removeEventListener('pointerup', onUp)
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) onDelete()
              }
              window.addEventListener('pointerup', onUp)
            }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#dc2626', border: '2px solid #fff',
              color: '#fff', cursor: 'pointer', fontSize: 16,
              fontWeight: 700, display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', padding: 0,
            }}
          >−</button>
        </Html>
      )}
    </group>
  )
}

export default function LineTool({
  active, items = [], selectedId, groundSize, panelSize = 2,
  selectable = true,
  onCreate, onSelect, onDelete, onDeselect,
}) {
  const { camera, gl } = useThree()
  const [firstPoint, setFirstPoint] = useState(null)
  const [wall, setWall] = useState(null) // { end, axis, count } preview

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
    const raw = [e.point.x, e.point.z]
    const snapped = snapAnchor(raw)

    if (!firstPoint) {
      setFirstPoint(snapped)
      setWall({ end: snapped, axis: 'x', count: 0 })
      return
    }

    const w = computeWall(firstPoint, snapped, panelSize)
    if (w.count >= 1) {
      onCreate({
        x1: firstPoint[0], z1: firstPoint[1],
        x2: w.end[0], z2: w.end[1],
        axis: w.axis, size: panelSize,
      })
    }
    setFirstPoint(null)
    setWall(null)
  }

  return (
    <group>
      {/* Invisible floor hit target */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onPointerDown={handleFloorDown}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {items.map((it) => (
        <PanelWall
          key={it.id}
          panel={it}
          selected={it.id === selectedId}
          onSelect={!active && selectable ? () => onSelect(it.id) : null}
          onDelete={onDelete ? () => onDelete(it.id) : null}
        />
      ))}

      {/* First-click anchor dot */}
      {active && firstPoint && (
        <mesh position={[firstPoint[0], 0.12, firstPoint[1]]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      )}

      {/* Live preview while drawing */}
      {active && firstPoint && wall && wall.count >= 1 && (
        <PanelWall
          panel={{
            x1: firstPoint[0], z1: firstPoint[1],
            x2: wall.end[0], z2: wall.end[1],
            axis: wall.axis, size: panelSize,
          }}
          preview
        />
      )}
    </group>
  )
}
