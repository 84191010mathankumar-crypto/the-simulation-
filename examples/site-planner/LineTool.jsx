import React, { useEffect, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'

const PANEL_HEIGHT = 1.5
const PANEL_THICKNESS = 0.12
const PANEL_COLOR = '#94a3b8'

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

function clickSelect(callback) {
  return (e) => {
    if (!callback) return
    e.stopPropagation()
    const sx = e.clientX, sy = e.clientY
    const onUp = (ev) => {
      window.removeEventListener('pointerup', onUp)
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) callback()
    }
    window.addEventListener('pointerup', onUp)
  }
}

function PanelWall({ panel, selected, preview, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const dx = panel.x2 - panel.x1
  const dz = panel.z2 - panel.z1
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length < 0.05) return null

  const cx = (panel.x1 + panel.x2) / 2
  const cz = (panel.z1 + panel.z2) / 2
  const angle = -Math.atan2(dz, dx)

  const color = preview ? PANEL_COLOR : selected ? '#60a5fa' : hovered ? '#93c5fd' : PANEL_COLOR
  const opacity = preview ? 0.45 : selected ? 0.92 : hovered ? 0.82 : 0.72

  return (
    <group position={[cx, PANEL_HEIGHT / 2, cz]} rotation={[0, angle, 0]}>
      <mesh
        onPointerDown={preview ? undefined : clickSelect(onSelect)}
        onPointerEnter={preview ? undefined : () => setHovered(true)}
        onPointerLeave={preview ? undefined : () => setHovered(false)}
      >
        <boxGeometry args={[length, PANEL_HEIGHT, PANEL_THICKNESS]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} depthWrite={!preview} />
        <Edges color={selected ? '#3b82f6' : '#64748b'} />
      </mesh>

      {selected && !preview && onDelete && (
        <Html
          center
          position={[0, PANEL_HEIGHT / 2 + 0.35, 0]}
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
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)', padding: 0,
            }}
          >−</button>
        </Html>
      )}
    </group>
  )
}

export default function LineTool({
  active, items = [], selectedId, groundSize,
  selectable = true,
  onCreate, onSelect, onDelete, onDeselect,
}) {
  const { camera, gl } = useThree()
  const [firstPoint, setFirstPoint] = useState(null)
  const [previewPoint, setPreviewPoint] = useState(null)

  useEffect(() => {
    if (!active) { setFirstPoint(null); setPreviewPoint(null) }
  }, [active])

  useEffect(() => {
    const dom = gl.domElement

    function handleMove(e) {
      if (!active || !firstPoint) return
      const p = groundPointFromEvent(e, camera, dom)
      if (p) setPreviewPoint(p)
    }

    dom.addEventListener('pointermove', handleMove)
    return () => dom.removeEventListener('pointermove', handleMove)
  }, [active, firstPoint, camera, gl])

  function handleFloorDown(e) {
    if (!active) { onDeselect(); return }
    e.stopPropagation()
    const p = [e.point.x, e.point.z]
    if (!firstPoint) {
      setFirstPoint(p)
      setPreviewPoint(p)
      return
    }
    const dx = p[0] - firstPoint[0]
    const dz = p[1] - firstPoint[1]
    if (Math.sqrt(dx * dx + dz * dz) > 0.15) {
      onCreate({ x1: firstPoint[0], z1: firstPoint[1], x2: p[0], z2: p[1] })
    }
    setFirstPoint(null)
    setPreviewPoint(null)
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
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      )}

      {/* Preview wall while drawing */}
      {active && firstPoint && previewPoint && (
        <PanelWall
          panel={{ x1: firstPoint[0], z1: firstPoint[1], x2: previewPoint[0], z2: previewPoint[1] }}
          preview
        />
      )}
    </group>
  )
}
