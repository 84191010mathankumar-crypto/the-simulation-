import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import useGantryStore, { BOX_HALF } from './useGantryStore'

const BOX_SIZE = [BOX_HALF * 2, BOX_HALF * 2, BOX_HALF * 2]

/**
 * Solid cube that visualises the payload. While the gripper is carrying it,
 * it just follows the gripper's pose directly — no IK/tool-frame math
 * needed since the gantry's pose *is* the tool tip position.
 */
export default function GantryCarriedObject({ color = '#ebe4d2' }) {
  const meshRef = useRef()

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const { animState, pose, startObject, endObject, carrying } = useGantryStore.getState()

    if (animState === 'idle') {
      mesh.visible = false
      return
    }
    mesh.visible = true

    if (carrying) {
      mesh.position.set(pose.x, pose.y, pose.z)
      mesh.rotation.set(0, pose.rotY, 0)
      return
    }

    const beforePick = animState === 'moving_to_start' || animState === 'descending_pick'
    const o = beforePick ? startObject : endObject
    mesh.position.set(o.position[0], o.position[1], o.position[2])
    mesh.rotation.set(0, o.rotY, 0)
  })

  return (
    <mesh ref={meshRef} castShadow visible={false}>
      <boxGeometry args={BOX_SIZE} />
      <meshStandardMaterial color={color} metalness={0.04} roughness={0.78} />
      <Edges color="#1a1f27" threshold={12} lineWidth={1} />
    </mesh>
  )
}
