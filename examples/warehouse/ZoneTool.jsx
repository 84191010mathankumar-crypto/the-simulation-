/**
 * Restricted-zone authoring tool for the warehouse floor.
 *
 * Workflow:
 *   1. Click "+ Draw zone" in the panel → `active` turns true.
 *   2. Click two points on the floor → a rectangle is created spanning them
 *      (always axis-aligned; whichever corner you click first/second just
 *      decides the diagonal, normalizeRect sorts it out).
 *   3. Click an existing zone to select it — four corner handles appear.
 *      Drag a handle to resize; the opposite corner stays put, so it always
 *      stays a rectangle no matter which way you drag.
 *
 * Dragging is done with native pointer events on the canvas (not R3F's
 * per-mesh events) so a fast mouse move that slips off a tiny handle still
 * keeps tracking — we just raycast the cursor against the y=0 floor plane
 * every move.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'

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

function normalizeRect(r) {
  return {
    minX: Math.min(r.minX, r.maxX),
    maxX: Math.max(r.minX, r.maxX),
    minZ: Math.min(r.minZ, r.maxZ),
    maxZ: Math.max(r.minZ, r.maxZ),
  }
}

const CORNERS = ['XminZmin', 'XminZmax', 'XmaxZmin', 'XmaxZmax']

function cornerPos(corner, rect) {
  const x = corner.includes('Xmin') ? rect.minX : rect.maxX
  const z = corner.includes('Zmin') ? rect.minZ : rect.maxZ
  return [x, 0.25, z]
}

function ZoneRect({ rect, selected, preview, onSelect, onStartDrag }) {
  const w = Math.max(0.05, rect.maxX - rect.minX)
  const d = Math.max(0.05, rect.maxZ - rect.minZ)
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2
  const color = preview ? '#f59e0b' : '#dc2626'

  return (
    <group>
      <mesh
        position={[cx, 0.2, cz]}
        onPointerDown={(e) => { if (onSelect) { e.stopPropagation(); onSelect() } }}
      >
        <boxGeometry args={[w, 0.4, d]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={preview ? 0.22 : selected ? 0.32 : 0.18}
          depthWrite={false}
        />
        <Edges color={color} />
      </mesh>
      {selected && !preview && CORNERS.map((c) => (
        <mesh
          key={c}
          position={cornerPos(c, rect)}
          onPointerDown={(e) => { e.stopPropagation(); onStartDrag(c) }}
        >
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
      ))}
    </group>
  )
}

export default function ZoneTool({
  active, zones = [], selectedZoneId, roomSize,
  onCreateZone, onSelectZone, onUpdateZone, onDeselect,
}) {
  const { camera, gl } = useThree()
  const [firstPoint, setFirstPoint] = useState(null)
  const [previewPoint, setPreviewPoint] = useState(null)
  const dragRef = useRef(null) // { zoneId, anchorX, anchorZ }

  // Clicking the tool off mid-draw should drop the half-made rectangle.
  useEffect(() => {
    if (!active) { setFirstPoint(null); setPreviewPoint(null) }
  }, [active])

  useEffect(() => {
    const dom = gl.domElement
    const half = roomSize / 2 - 0.2

    function handleMove(e) {
      const p = groundPointFromEvent(e, camera, dom)
      if (!p) return

      if (dragRef.current) {
        const { zoneId, anchorX, anchorZ } = dragRef.current
        const cx = Math.max(-half, Math.min(half, p[0]))
        const cz = Math.max(-half, Math.min(half, p[1]))
        onUpdateZone(zoneId, normalizeRect({ minX: anchorX, maxX: cx, minZ: anchorZ, maxZ: cz }))
        return
      }

      if (active && firstPoint) setPreviewPoint(p)
    }

    function handleUp() { dragRef.current = null }

    dom.addEventListener('pointermove', handleMove)
    dom.addEventListener('pointerup', handleUp)
    return () => {
      dom.removeEventListener('pointermove', handleMove)
      dom.removeEventListener('pointerup', handleUp)
    }
  }, [active, firstPoint, onUpdateZone, camera, gl, roomSize])

  function handleFloorDown(e) {
    if (!active) { onDeselect(); return }
    e.stopPropagation()
    const p = [e.point.x, e.point.z]
    if (!firstPoint) {
      setFirstPoint(p)
      setPreviewPoint(p)
      return
    }
    const rect = normalizeRect({ minX: firstPoint[0], maxX: p[0], minZ: firstPoint[1], maxZ: p[1] })
    if (rect.maxX - rect.minX > 0.15 && rect.maxZ - rect.minZ > 0.15) onCreateZone(rect)
    setFirstPoint(null)
    setPreviewPoint(null)
  }

  return (
    <group>
      {/* Catches clicks for placing points / deselecting. Fully transparent
          (not `visible={false}`) so it still raycasts. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} onPointerDown={handleFloorDown}>
        <planeGeometry args={[roomSize, roomSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {zones.map((z) => (
        <ZoneRect
          key={z.id}
          rect={z}
          selected={z.id === selectedZoneId}
          onSelect={active ? null : () => onSelectZone(z.id)}
          onStartDrag={(corner) => {
            const anchorX = corner.includes('Xmin') ? z.maxX : z.minX
            const anchorZ = corner.includes('Zmin') ? z.maxZ : z.minZ
            dragRef.current = { zoneId: z.id, anchorX, anchorZ }
          }}
        />
      ))}

      {active && firstPoint && previewPoint && (
        <ZoneRect
          rect={normalizeRect({ minX: firstPoint[0], maxX: previewPoint[0], minZ: firstPoint[1], maxZ: previewPoint[1] })}
          preview
        />
      )}
    </group>
  )
}
