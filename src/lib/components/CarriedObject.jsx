import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'
import * as THREE from 'three'
import { useRobotStore } from '../state/context'
import { easeInOutCubic } from '../ik/ikSolver'

const BOX_SIZE = [0.22, 0.22, 0.22]

/**
 * Solid cube that visualises the payload during a Run sequence.
 *
 *   moving_to_start → parked at start pose (waiting for the gripper)
 *   grabbing        → parked at start pose
 *   moving_to_end   → position taken from the gripper's pinch frame (so the
 *                     cube visually sits in the jaws); orientation slerped
 *                     start→end across animProgress so it lands EXACTLY at
 *                     endObject.rotation by the time we release.  This is
 *                     necessary because CCD IK leaves spin about the tool
 *                     axis (joint_6) unconstrained, so following the wrist's
 *                     rotation rigidly would jump at release.
 *   releasing       → snap to end pose (zero motion if slerp landed clean)
 *   returning       → stay at end pose while the arm goes home
 *   idle            → hidden
 */
export default function CarriedObject({ color = '#e0a050' }) {
  const meshRef     = useRef()
  const prevStateRef = useRef('idle')
  // Pose offset from tool0 to cube CENTRE (in tool-local), cached at grab time
  const localPosRef  = useRef(new THREE.Vector3())
  // Start/end rotations as quaternions, captured at grab time
  const startQuatRef = useRef(new THREE.Quaternion())
  const endQuatRef   = useRef(new THREE.Quaternion())

  const _toolPos  = useRef(new THREE.Vector3()).current
  const _toolQuat = useRef(new THREE.Quaternion()).current
  const _outPos   = useRef(new THREE.Vector3()).current
  const _outQuat  = useRef(new THREE.Quaternion()).current

  const useStore = useRobotStore()

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const { animState, animProgress, startObject, endObject, robotRef } = useStore.getState()

    const prev = prevStateRef.current
    prevStateRef.current = animState

    if (animState === 'idle') {
      mesh.visible = false
      return
    }
    mesh.visible = true

    const placeAt = (o) => {
      mesh.position.set(o.position[0], o.position[1], o.position[2])
      mesh.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2])
    }

    if (animState === 'moving_to_start' || animState === 'grabbing') {
      placeAt(startObject)
      return
    }

    if (animState === 'moving_to_end') {
      const tool = robotRef?.links?.tool0 || robotRef?.links?.flange || robotRef?.links?.link_6
      if (!tool) { placeAt(startObject); return }

      // On entry, cache the cube-centre offset in tool-local space and both
      // endpoint orientations so we can slerp the spin to land cleanly.
      if (prev !== 'moving_to_end') {
        tool.updateWorldMatrix(true, false)
        tool.getWorldPosition(_toolPos)
        tool.getWorldQuaternion(_toolQuat)

        const cubeWorldPos = new THREE.Vector3(...startObject.position)
        const invTool = _toolQuat.clone().invert()
        localPosRef.current.copy(cubeWorldPos).sub(_toolPos).applyQuaternion(invTool)

        startQuatRef.current.setFromEuler(
          new THREE.Euler(startObject.rotation[0], startObject.rotation[1], startObject.rotation[2], 'XYZ')
        )
        endQuatRef.current.setFromEuler(
          new THREE.Euler(endObject.rotation[0], endObject.rotation[1], endObject.rotation[2], 'XYZ')
        )
      }

      // Refresh end-quaternion each frame so live edits to endObject.rotation
      // are respected even mid-segment.
      endQuatRef.current.setFromEuler(
        new THREE.Euler(endObject.rotation[0], endObject.rotation[1], endObject.rotation[2], 'XYZ')
      )

      tool.updateWorldMatrix(true, false)
      tool.getWorldPosition(_toolPos)
      tool.getWorldQuaternion(_toolQuat)

      // Position: follow the gripper (cube centre = tool0 + tool-local offset)
      _outPos.copy(localPosRef.current).applyQuaternion(_toolQuat).add(_toolPos)

      // Orientation: slerp from start to end using the same easing the joints use.
      // On the entry frame, AnimationController hasn't run yet to reset
      // animProgress (it's still 1 from the previous segment), so force t=0
      // to avoid a one-frame flip to the end orientation.
      const rawProgress = prev !== 'moving_to_end' ? 0 : Math.max(0, Math.min(1, animProgress))
      const t = easeInOutCubic(rawProgress)
      _outQuat.copy(startQuatRef.current).slerp(endQuatRef.current, t)

      mesh.position.copy(_outPos)
      mesh.quaternion.copy(_outQuat)
      return
    }

    // releasing | returning → park at end pose
    placeAt(endObject)
  })

  return (
    <mesh ref={meshRef} castShadow visible={false}>
      <boxGeometry args={BOX_SIZE} />
      <meshStandardMaterial color={color} metalness={0.04} roughness={0.78} />
      <Edges color="#1a1f27" threshold={12} lineWidth={1} />
    </mesh>
  )
}
