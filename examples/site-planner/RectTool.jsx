/**
 * Generic "draw a rectangle on the floor" tool — used for both gantry
 * operating areas and grid areas. Click two points on the floor to draw a
 * rectangle; click an existing rectangle to select it and drag its corner
 * handles to resize.
 *
 * This is the same interaction as the warehouse demo's ZoneTool, just made
 * reusable so the site planner can have several independent rectangle
 * layers (one per item type) with their own colour.
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

function cornerPos(corner, rect, y) {
  const x = corner.includes('Xmin') ? rect.minX : rect.maxX
  const z = corner.includes('Zmin') ? rect.minZ : rect.maxZ
  return [x, y, z]
}

function Rect({ rect, selected, preview, color, y, opacity, renderRobot, onSelect, onStartDrag }) {
  const w = Math.max(0.05, rect.maxX - rect.minX)
  const d = Math.max(0.05, rect.maxZ - rect.minZ)
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2

  return (
    <group>
      <mesh
        position={[cx, y, cz]}
        onPointerDown={(e) => { if (onSelect) { e.stopPropagation(); onSelect() } }}
      >
        <boxGeometry args={[w, 0.05, d]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={preview ? 0.25 : selected ? Math.min(1, opacity * 1.7) : opacity}
          depthWrite={false}
        />
        <Edges color={color} />
      </mesh>
      {renderRobot && !preview && renderRobot(rect)}
      {selected && !preview && CORNERS.map((c) => (
        <mesh
          key={c}
          position={cornerPos(c, rect, y + 0.1)}
          onPointerDown={(e) => { e.stopPropagation(); onStartDrag(c) }}
        >
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

export default function RectTool({
  active, items = [], selectedId, color = '#dc2626', y = 0.12, opacity = 0.22, groundSize,
  renderRobot, onCreate, onSelect, onUpdate, onDeselect,
}) {
  const { camera, gl } = useThree()
  const [firstPoint, setFirstPoint] = useState(null)
  const [previewPoint, setPreviewPoint] = useState(null)
  const dragRef = useRef(null)

  useEffect(() => {
    if (!active) { setFirstPoint(null); setPreviewPoint(null) }
  }, [active])

  useEffect(() => {
    const dom = gl.domElement
    const half = groundSize / 2

    function handleMove(e) {
      const p = groundPointFromEvent(e, camera, dom)
      if (!p) return

      if (dragRef.current) {
        const { itemId, anchorX, anchorZ } = dragRef.current
        const cx = Math.max(-half, Math.min(half, p[0]))
        const cz = Math.max(-half, Math.min(half, p[1]))
        onUpdate(itemId, normalizeRect({ minX: anchorX, maxX: cx, minZ: anchorZ, maxZ: cz }))
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
  }, [active, firstPoint, onUpdate, camera, gl, groundSize])

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
    if (rect.maxX - rect.minX > 0.15 && rect.maxZ - rect.minZ > 0.15) onCreate(rect)
    setFirstPoint(null)
    setPreviewPoint(null)
  }

  return (
    <group>
      {/* Invisible click-catcher covering the whole ground footprint. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y - 0.06, 0]} onPointerDown={handleFloorDown}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {items.map((it) => (
        <Rect
          key={it.id}
          rect={it}
          color={color}
          y={y}
          opacity={opacity}
          renderRobot={renderRobot}
          selected={it.id === selectedId}
          onSelect={active ? null : () => onSelect(it.id)}
          onStartDrag={(corner) => {
            const anchorX = corner.includes('Xmin') ? it.maxX : it.minX
            const anchorZ = corner.includes('Zmin') ? it.maxZ : it.minZ
            dragRef.current = { itemId: it.id, anchorX, anchorZ }
          }}
        />
      ))}

      {active && firstPoint && previewPoint && (
        <Rect
          rect={normalizeRect({ minX: firstPoint[0], maxX: previewPoint[0], minZ: firstPoint[1], maxZ: previewPoint[1] })}
          color={color}
          y={y}
          opacity={opacity}
          preview
        />
      )}
    </group>
  )
}
