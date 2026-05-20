import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'

const _tipWorld = new THREE.Vector3()
const _tipQuat  = new THREE.Quaternion()
const _toolZ    = new THREE.Vector3()
const PINCH_Z   = 0.18   // matches the IK pinch offset in src/lib/ik/ikSolver.js

/**
 * Visual representation of one task's box.  Position is computed every frame:
 *   - pending or assigned-but-not-yet-carried → resting at task.from
 *   - carried (during moving_to_end / releasing) → glued to robot.tool0 pinch
 *   - done → resting at task.to
 *
 * The drop zone is rendered as a flat outlined square on the floor (drawn
 * by <TargetZone /> separately).
 */
export default function TaskBox({ task, robots, status, carriedByRobotId }) {
  const groupRef = useRef()

  useFrame(() => {
    const g = groupRef.current
    if (!g) return

    if (carriedByRobotId) {
      const robot = robots.find((r) => r.id === carriedByRobotId)
      const tip = robot?.store.getState().robotRef?.links?.tool0
                 || robot?.store.getState().robotRef?.links?.flange
                 || robot?.store.getState().robotRef?.links?.link_6
      if (tip) {
        tip.getWorldPosition(_tipWorld)
        tip.getWorldQuaternion(_tipQuat)
        _toolZ.set(0, 0, 1).applyQuaternion(_tipQuat)
        g.position.copy(_tipWorld).addScaledVector(_toolZ, PINCH_Z)
        g.quaternion.copy(_tipQuat)
        return
      }
    }

    if (status === 'done') {
      g.position.set(task.to[0], task.size[1] / 2, task.to[1])
    } else {
      g.position.set(task.from[0], task.size[1] / 2, task.from[1])
    }
    g.rotation.set(0, 0, 0)
  })

  const dim = status === 'done' ? 0.55 : 1.0
  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={task.size} />
        <meshStandardMaterial
          color={task.color}
          metalness={0.25}
          roughness={0.55}
          transparent
          opacity={dim}
        />
        <Edges color={task.color} threshold={5} lineWidth={1.4} />
      </mesh>
    </group>
  )
}
