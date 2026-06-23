/**
 * "Place a point on the floor" tool — used for robo arms, which (unlike
 * gantries/grids) just need a single mounting position, not an area.
 *
 * While active, clicking the floor drops a new marker. At any time, click
 * an existing marker to select it (and delete it from the panel), or drag
 * it to reposition.
 */
import React, { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoboArmVisual } from './RobotVisuals'

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

function ArmMarker({ point, selected, valid, onSelect, onStartDrag }) {
  return (
    <group>
      {/* Invisible, generously-sized hit target — the robot silhouette
          underneath is too thin/irregular to reliably click on directly. */}
      <mesh
        position={[point.x, 0.6, point.z]}
        onPointerDown={(e) => { e.stopPropagation(); onStartDrag(); if (onSelect) onSelect() }}
      >
        <cylinderGeometry args={[0.45, 0.45, 1.3, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <RoboArmVisual x={point.x} z={point.z} valid={valid} highlight={selected} />
    </group>
  )
}

export default function PointTool({
  active, items = [], selectedId, isValid, groundSize,
  onCreate, onSelect, onUpdate, onDeselect,
}) {
  const { camera, gl } = useThree()
  const dragRef = useRef(null)

  useEffect(() => {
    const dom = gl.domElement
    const half = groundSize / 2

    function handleMove(e) {
      if (!dragRef.current) return
      const p = groundPointFromEvent(e, camera, dom)
      if (!p) return
      const x = Math.max(-half, Math.min(half, p[0]))
      const z = Math.max(-half, Math.min(half, p[1]))
      onUpdate(dragRef.current, { x, z })
    }
    function handleUp() { dragRef.current = null }

    dom.addEventListener('pointermove', handleMove)
    dom.addEventListener('pointerup', handleUp)
    return () => {
      dom.removeEventListener('pointermove', handleMove)
      dom.removeEventListener('pointerup', handleUp)
    }
  }, [onUpdate, camera, gl, groundSize])

  function handleFloorDown(e) {
    if (!active) { onDeselect(); return }
    e.stopPropagation()
    onCreate({ x: e.point.x, z: e.point.z })
  }

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} onPointerDown={handleFloorDown}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {items.map((it) => (
        <ArmMarker
          key={it.id}
          point={it}
          valid={isValid ? isValid(it) : true}
          selected={it.id === selectedId}
          onSelect={active ? null : () => onSelect(it.id)}
          onStartDrag={() => { dragRef.current = it.id }}
        />
      ))}
    </group>
  )
}
