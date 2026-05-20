import React, { useRef, useCallback, useMemo } from 'react'
import { TransformControls, Edges } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../store/useStore'

const BOX_SIZE = [0.15, 0.15, 0.15]
export const BOX_HALF = BOX_SIZE[0] / 2

/**
 * Renders a work object (start or end position) as a wireframe box with:
 * - TransformControls gizmo (translate or rotate)
 * - Grab direction arrow indicator
 * - Outline edges
 */
export default function WorkObject({ objectKey, color }) {
  const meshRef = useRef()

  const {
    startObject, endObject,
    setStartObject, setEndObject,
    selectedObject, setSelectedObject,
    transformMode,
  } = useStore()

  const isStart    = objectKey === 'start'
  const obj        = isStart ? startObject : endObject
  const setObj     = isStart ? setStartObject : setEndObject
  const isSelected = selectedObject === objectKey

  // Sync position/rotation back to store as user drags
  const onTransformChange = useCallback(() => {
    if (!meshRef.current) return
    const p = meshRef.current.position
    const r = meshRef.current.rotation
    setObj({ position: [p.x, p.y, p.z], rotation: [r.x, r.y, r.z] })
  }, [setObj])

  // Build arrow geometry for grab direction.
  // The grab POINT is on the centre of one face of the box (offset from the
  // box centre along the grab vector by half the box size). The arrow starts
  // at that face centre and points outward — that's where the gripper docks.
  const { arrowDir, arrowOrigin, arrowLength } = useMemo(() => {
    const dirLocal = new THREE.Vector3(...obj.grabVector).normalize()
    const rotM     = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')
    )
    const dirWorld = dirLocal.clone().applyMatrix4(rotM)
    const origin   = new THREE.Vector3(...obj.position).addScaledVector(dirWorld, BOX_HALF)
    return { arrowDir: dirWorld, arrowOrigin: origin, arrowLength: 0.18 }
  }, [obj.position, obj.rotation, obj.grabVector])

  // Stable ArrowHelper object — update in place when position/direction changes
  const arrowHelper = useMemo(() => {
    const ah = new THREE.ArrowHelper(arrowDir, arrowOrigin, arrowLength, color, 0.05, 0.03)
    ah.renderOrder = 999
    return ah
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // created once; updated imperatively below

  // Keep arrow in sync with current obj state
  useMemo(() => {
    arrowHelper.setDirection(arrowDir)
    arrowHelper.position.copy(arrowOrigin)
    arrowHelper.setLength(arrowLength, 0.05, 0.03)
  }, [arrowHelper, arrowDir, arrowOrigin, arrowLength])

  return (
    <group>
      {/* Transparent box with outlined edges */}
      <mesh
        ref={meshRef}
        position={obj.position}
        rotation={obj.rotation}
        onClick={(e) => { e.stopPropagation(); setSelectedObject(objectKey) }}
        castShadow
      >
        <boxGeometry args={BOX_SIZE} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.18 : 0.08}
          depthWrite={false}
        />
        <Edges color={color} threshold={5} lineWidth={isSelected ? 2.5 : 1.2} />
      </mesh>

      {/* Grab direction arrow */}
      <primitive object={arrowHelper} />

      {/* TransformControls — only when this object is selected */}
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode={transformMode}
          size={0.55}
          onChange={onTransformChange}
        />
      )}
    </group>
  )
}
