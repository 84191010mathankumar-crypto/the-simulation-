import React, { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import URDFLoader from 'urdf-loader'
import useStore, { JOINT_NAMES, HOME_ANGLES } from '../store/useStore'
import { applyAnglesToRobot } from '../utils/ikSolver'

// Real KUKA colour scheme:
//   base / link_1–3  → KUKA orange
//   link_4–6 (wrist) → anthracite grey
//   base_link        → dark charcoal (pedestal)
const MATERIALS = {
  orange:     () => new THREE.MeshStandardMaterial({ color: 0xff6000, metalness: 0.30, roughness: 0.50 }),
  anthracite: () => new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.55, roughness: 0.40 }),
  charcoal:   () => new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.60, roughness: 0.35 }),
}

function meshMaterial(path) {
  const file = path.split('/').pop().replace('.stl', '').toLowerCase()
  if (file === 'base_link')                          return MATERIALS.charcoal()
  if (file === 'link_4' || file === 'link_5' || file === 'link_6') return MATERIALS.anthracite()
  return MATERIALS.orange()   // link_1, link_2, link_3
}

function applyMaterials(obj, path) {
  if (!obj) return
  const mat = meshMaterial(path)
  obj.traverse((child) => {
    if (!child.isMesh) return
    child.material      = mat
    child.castShadow    = true
    child.receiveShadow = true
  })
}

/**
 * Parallel-jaw gripper geometry, built once and attached to the flange link.
 * Local +Z of the flange points along the tool axis (away from the wrist),
 * so the gripper extends down the +Z axis.
 *
 * Total reach from flange origin to finger tip ≈ GRIPPER_REACH (used by IK).
 */
export const GRIPPER_REACH = 0.22
function buildGripper() {
  const g = new THREE.Group()
  const dark    = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.6, roughness: 0.35 })
  const accent  = new THREE.MeshStandardMaterial({ color: 0xff6000, metalness: 0.30, roughness: 0.50 })
  const rubber  = new THREE.MeshStandardMaterial({ color: 0x111316, metalness: 0.1, roughness: 0.85 })

  // 1) Mounting flange disc (against link_6's flange surface)
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.025, 32),
    accent
  )
  mount.rotation.x = Math.PI / 2          // align cylinder axis with +Z
  mount.position.set(0, 0, 0.0125)
  g.add(mount)

  // 2) Wrist body — slightly tapered prism
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.07, 24),
    dark
  )
  body.rotation.x = Math.PI / 2
  body.position.set(0, 0, 0.06)
  g.add(body)

  // 3) Knuckle / base of fingers
  const knuckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.08, 0.04),
    dark
  )
  knuckle.position.set(0, 0, 0.115)
  g.add(knuckle)

  // 4) Two parallel fingers extending forward
  const fingerLen = 0.085
  const fingerW   = 0.022
  const fingerH   = 0.05
  const halfGap   = 0.05      // half-distance between fingers (10cm jaw opening)

  for (const side of [-1, 1]) {
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(fingerW, fingerH, fingerLen),
      dark
    )
    finger.position.set(side * halfGap, 0, 0.135 + fingerLen / 2)
    g.add(finger)

    // Rubber pad on the inner face
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, fingerH * 0.85, fingerLen * 0.8),
      rubber
    )
    pad.position.set(side * (halfGap - fingerW / 2 - 0.0025), 0, 0.140 + fingerLen / 2)
    g.add(pad)
  }

  g.traverse((c) => {
    if (c.isMesh) { c.castShadow = true; c.receiveShadow = true }
  })
  return g
}

export default function RobotArm() {
  const { scene } = useThree()
  const robotRef  = useRef(null)
  const { setRobotLoaded, setRobotRef, addLog } = useStore()

  useEffect(() => {
    let cancelled = false
    const loader  = new URDFLoader()
    loader.packages = { robot: '/robot' }

    // urdf-loader ALWAYS overwrites mesh.material inside the done() callback:
    //   done(obj, err) → obj.material = new MeshPhongMaterial()  ← synchronous
    //
    // Fix: wrap loadMeshCb so we call done() first (letting urdf-loader apply
    // its white material), then immediately override with our orange.
    const builtinCb = loader.loadMeshCb
    loader.loadMeshCb = (path, manager, done) => {
      builtinCb(path, manager, (obj, err) => {
        done(obj, err)              // ← urdf-loader sets white MeshPhongMaterial here
        applyMaterials(obj, path)   // ← we override per-link right after, synchronously
      })
    }

    loader.load(
      '/robot/kr210_r2700_2.urdf',
      (robot) => {
        if (cancelled) return

        // URDF is ROS-convention (Z-up); Three.js scene is Y-up.
        // Rotate -90° about X so the base sits flat on the ground plane.
        // Raise slightly so the base mounts on top of the pedestal plate.
        robot.position.set(0, 0.05, 0)
        robot.rotation.set(-Math.PI / 2, 0, 0)

        scene.add(robot)
        robotRef.current = robot
        applyAnglesToRobot(robot, HOME_ANGLES)

        // Attach gripper to the flange/tool0 link so it follows the wrist
        const tip = robot.links?.tool0 || robot.links?.flange || robot.links?.link_6
        if (tip) {
          const gripper = buildGripper()
          gripper.name = 'gripper'
          tip.add(gripper)
        }

        useStore.setState({ robotRef: robot })
        setRobotLoaded(true)
        setRobotRef(robot)

        // Expose for devtools/eval poking (handy when iterating on IK).
        if (typeof window !== 'undefined' && import.meta.env.DEV) {
          window.__robot = robot
          window.__THREE = THREE
        }

        addLog('ok',   'KUKA KR210 R2700-2 loaded')
        addLog('info', 'Joints', Object.fromEntries(
          JOINT_NAMES.map((n) => [n, robot.joints[n] ? '✓' : '✗'])
        ))
      },
      undefined,
      (err) => {
        if (cancelled) return
        console.error('URDF load error:', err)
        addLog('error', `URDF load failed: ${err?.message ?? err}`)
      }
    )

    return () => {
      cancelled = true
      if (robotRef.current) scene.remove(robotRef.current)
    }
  }, [])

  useEffect(() => {
    return useStore.subscribe(
      (state) => state.jointAngles,
      (angles) => {
        if (robotRef.current) applyAnglesToRobot(robotRef.current, angles)
      }
    )
  }, [])

  return null
}
