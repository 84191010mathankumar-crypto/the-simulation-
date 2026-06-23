/**
 * A single unit box the arms carry from a storage area to its build target.
 *
 * Mirrors the warehouse demo's <Box>: the mesh transform is owned imperatively
 * by the scheduler (it slerps the box under the gripper during transport), so
 * we deliberately do NOT drive `position` as a JSX prop — we only seed the
 * pickup pose once and register the real THREE.Mesh for the scheduler to move.
 */
import React, { useEffect, useRef } from 'react'
import { Edges } from '@react-three/drei'

export default function SimBox({ box, registerMeshRef }) {
  const ref = useRef()

  useEffect(() => {
    registerMeshRef(box.id, ref.current)
    return () => registerMeshRef(box.id, null)
  }, [box.id, registerMeshRef])

  const [fx, fy, fz] = box.from
  useEffect(() => {
    if (!ref.current) return
    ref.current.position.set(fx, fy, fz)
    ref.current.rotation.set(0, 0, 0)
  }, [fx, fy, fz])

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={box.size} />
      <meshStandardMaterial color="#c9a227" metalness={0.05} roughness={0.8} />
      <Edges color="#5b4708" threshold={12} lineWidth={1} />
    </mesh>
  )
}
