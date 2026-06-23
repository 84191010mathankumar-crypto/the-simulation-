import React, { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
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

/**
 * Returns an onPointerDown handler that only fires `callback` if the pointer
 * was released within a small radius — i.e. a real click, not an orbit/pan
 * drag.  Always stopPropagation so the active tool's floor plane doesn't also
 * receive a draw click on top of an existing item.
 */
function clickSelect(callback) {
  return (e) => {
    e.stopPropagation()
    if (!callback) return
    const sx = e.clientX, sy = e.clientY
    const onUp = (ev) => {
      window.removeEventListener('pointerup', onUp)
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) callback()
    }
    window.addEventListener('pointerup', onUp)
  }
}

function cornerPos(corner, rect, y) {
  const x = corner.includes('Xmin') ? rect.minX : rect.maxX
  const z = corner.includes('Zmin') ? rect.minZ : rect.maxZ
  return [x, y, z]
}

function Rect({ rect, selected, preview, color, y, opacity, renderRobot, onSelect, onDelete, onStartDrag }) {
  const w = Math.max(0.05, rect.maxX - rect.minX)
  const d = Math.max(0.05, rect.maxZ - rect.minZ)
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2

  return (
    <group>
      <mesh
        position={[cx, y, cz]}
        onPointerDown={clickSelect(onSelect)}
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
            position={cornerPos(c, rect, y + 0.15)}
            onPointerDown={(e) => { e.stopPropagation(); onStartDrag(c) }}
          >
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {selected && !preview && onDelete && (
        <Html
          center
          position={[cx, y + 0.5, cz]}
          style={{ pointerEvents: 'all' }}
          zIndexRange={[100, 0]}
        >
          <button
            onPointerDown={clickSelect(onDelete)}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#dc2626', border: '2px solid #fff',
              color: '#fff', cursor: 'pointer', fontSize: 16,
              fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              padding: 0,
            }}
          >−</button>
        </Html>
      )}
    </group>
  )
}

export default function RectTool({
  active, items = [], selectedId, color = '#dc2626', y = 0.12, opacity = 0.22, groundSize,
  selectable = true,
  renderRobot, onCreate, onSelect, onUpdate, onDelete, onDeselect,
}) {
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls)
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
        if (controls) controls.enabled = false
        const { itemId, anchorX, anchorZ } = dragRef.current
        const cx = Math.max(-half, Math.min(half, p[0]))
        const cz = Math.max(-half, Math.min(half, p[1]))
        onUpdate(itemId, normalizeRect({ minX: anchorX, maxX: cx, minZ: anchorZ, maxZ: cz }))
        return
      }

      if (active && firstPoint) setPreviewPoint(p)
    }

    function handleUp() {
      if (dragRef.current) {
        dragRef.current = null
        if (controls) controls.enabled = true
      }
    }

    dom.addEventListener('pointermove', handleMove)
    dom.addEventListener('pointerup', handleUp)
    return () => {
      dom.removeEventListener('pointermove', handleMove)
      dom.removeEventListener('pointerup', handleUp)
    }
  }, [active, firstPoint, onUpdate, camera, gl, groundSize, controls])

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
          onSelect={selectable ? () => onSelect(it.id) : null}
          onDelete={onDelete ? () => onDelete(it.id) : null}
          onStartDrag={(corner) => {
            const anchorX = corner.includes('Xmin') ? it.maxX : it.minX
            const anchorZ = corner.includes('Zmin') ? it.maxZ : it.minZ
            dragRef.current = { itemId: it.id, anchorX, anchorZ }
            if (controls) controls.enabled = false
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
