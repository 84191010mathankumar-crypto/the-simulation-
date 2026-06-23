import React, { useMemo, useCallback } from 'react'
import { PivotControls, Edges } from '@react-three/drei'
import * as THREE from 'three'
import useGantryStore, { BOX_HALF } from './useGantryStore'

const BOX_SIZE = [BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2]

/**
 * Renders a start/end marker box. Position is draggable in 3D (translate
 * only — the gantry only ever travels in straight lines); rotation around
 * the vertical axis is set from the control panel instead, since that's the
 * only rotation the gripper can actually perform.
 */
export default function GantryWorkObject({ objectKey, color }) {
  const startObject   = useGantryStore((s) => s.startObject)
  const endObject      = useGantryStore((s) => s.endObject)
  const setStartObject = useGantryStore((s) => s.setStartObject)
  const setEndObject   = useGantryStore((s) => s.setEndObject)

  const isStart = objectKey === 'start'
  const obj    = isStart ? startObject : endObject
  const setObj = isStart ? setStartObject : setEndObject

  const initialMatrix = useMemo(() => {
    const m = new THREE.Matrix4()
    m.setPosition(...obj.position)
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDrag = useCallback((world) => {
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    world.decompose(pos, quat, scl)
    setObj({ position: [pos.x, pos.y, pos.z] })
  }, [setObj])

  return (
    <PivotControls
      scale={48}
      fixed
      lineWidth={1.6}
      depthTest={false}
      anchor={[0, 0, 0]}
      activeAxes={[true, false, true]}
      disableSliders
      disableRotations
      annotations
      annotationsClass="pivot-annot"
      matrix={initialMatrix}
      autoTransform
      onDrag={onDrag}
    >
      <mesh castShadow rotation={[0, obj.rotY, 0]}>
        <boxGeometry args={BOX_SIZE} />
        <meshStandardMaterial color={color} transparent opacity={0.18} depthWrite={false} />
        <Edges color={color} threshold={5} lineWidth={1} />
      </mesh>
    </PivotControls>
  )
}
