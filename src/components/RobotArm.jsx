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

        robot.position.set(0, 0, 0)
        robot.rotation.set(0, 0, 0)

        scene.add(robot)
        robotRef.current = robot
        applyAnglesToRobot(robot, HOME_ANGLES)

        useStore.setState({ robotRef: robot })
        setRobotLoaded(true)
        setRobotRef(robot)

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
