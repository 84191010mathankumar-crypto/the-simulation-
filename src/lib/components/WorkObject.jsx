import React, { useMemo, useRef, useCallback } from 'react'
import { PivotControls, Edges } from '@react-three/drei'
import * as THREE from 'three'
import { useRobotStore } from '../state/context'

const BOX_SIZE = [0.15, 0.15, 0.15]
export const BOX_HALF = BOX_SIZE[0] / 2

/**
 * Renders a work object (start or end pose) with:
 *  - Transparent edged box
 *  - Grab arrow originating at the centre of the grab face
 *  - drei <PivotControls> gumball — translate AND rotate in one widget
 */
export default function WorkObject({ objectKey, color }) {
  const groupRef = useRef()
  const lastMatrixRef = useRef(null)

  const useStore = useRobotStore()
  const startObject    = useStore((s) => s.startObject)
  const endObject      = useStore((s) => s.endObject)
  const setStartObject = useStore((s) => s.setStartObject)
  const setEndObject   = useStore((s) => s.setEndObject)

  const isStart = objectKey === 'start'
  const obj     = isStart ? startObject : endObject
  const setObj  = isStart ? setStartObject : setEndObject

  // Build the initial matrix the gumball starts from (only first render).
  const initialMatrix = useMemo(() => {
    const m = new THREE.Matrix4()
    const pos = new THREE.Vector3(...obj.position)
    const eul = new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')
    const q   = new THREE.Quaternion().setFromEuler(eul)
    m.compose(pos, q, new THREE.Vector3(1, 1, 1))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While dragging the gumball, write the new pose back into the store.
  const onDrag = useCallback((world) => {
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    world.decompose(pos, quat, scl)
    const eul = new THREE.Euler().setFromQuaternion(quat, 'XYZ')
    setObj({
      position: [pos.x, pos.y, pos.z],
      rotation: [eul.x, eul.y, eul.z],
    })
    lastMatrixRef.current = world.clone()
  }, [setObj])

  // Arrow — origin sits on the face the grab vector points out of,
  // pointing along that vector in world space.
  const arrowHelper = useMemo(() => {
    const dirLocal = new THREE.Vector3(...obj.grabVector).normalize()
    const rotM = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(obj.rotation[0], obj.rotation[1], obj.rotation[2], 'XYZ')
    )
    const dirWorld = dirLocal.clone().applyMatrix4(rotM)
    const origin   = new THREE.Vector3(...obj.position).addScaledVector(dirWorld, BOX_HALF)
    const ah = new THREE.ArrowHelper(dirWorld, origin, 0.20, color, 0.05, 0.03)
    ah.renderOrder = 999
    return ah
  }, [obj.position, obj.rotation, obj.grabVector, color])

  return (
    <>
      <PivotControls
        scale={48}                 // pixel size (with fixed=true)
        fixed
        lineWidth={1.6}
        depthTest={false}
        anchor={[0, 0, 0]}
        activeAxes={[true, true, true]}
        disableSliders            // removes the plane (square) handles
        annotations
        annotationsClass="pivot-annot"
        matrix={initialMatrix}
        autoTransform
        onDrag={onDrag}
      >
        <mesh ref={groupRef} castShadow>
          <boxGeometry args={BOX_SIZE} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.18}
            depthWrite={false}
          />
          <Edges color={color} threshold={5} lineWidth={1} />
        </mesh>
      </PivotControls>

      {/* Grab arrow lives outside PivotControls so we draw it from world coords */}
      <primitive object={arrowHelper} />
    </>
  )
}
