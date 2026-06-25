/**
 * A single panel the arms carry from panel storage to its target wall position.
 * Identical pattern to SimBox: the scheduler owns the transform imperatively.
 */
import React, { useEffect, useRef } from 'react'
import { Edges } from '@react-three/drei'

export default function SimPanel({ box, registerMeshRef }) {
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
    <mesh ref={ref} castShadow>
      <boxGeometry args={box.size} />
      <meshStandardMaterial color="#e2e8f0" metalness={0.12} roughness={0.55} />
      <Edges color="#94a3b8" lineWidth={1} />
    </mesh>
  )
}
