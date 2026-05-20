import React, { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import URDFLoader from 'urdf-loader'
import useStore, { JOINT_NAMES, HOME_ANGLES } from '../store/useStore'
import { applyAnglesToRobot } from '../utils/ikSolver'

/**
 * Loads the KUKA KR210 R2700-2 URDF and adds it to the scene.
 * The robot mesh material is a metallic grey with edge highlights.
 */
export default function RobotArm() {
  const { scene, gl } = useThree()
  const robotRef = useRef(null)
  const { setRobotLoaded, setRobotRef, jointAngles, addLog } = useStore()

  useEffect(() => {
    let cancelled = false
    const loader = new URDFLoader()

    // Tell urdf-loader how to resolve package:// URLs
    loader.packages = {
      robot: '/robot',
    }

    // Use THREE STLLoader for .stl meshes
    loader.loadMeshCb = (path, manager, done) => {
      import('three/examples/jsm/loaders/STLLoader.js').then(({ STLLoader }) => {
        const stlLoader = new STLLoader(manager)
        stlLoader.load(
          path,
          (geometry) => {
            geometry.computeVertexNormals()
            const mesh = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({
                color: 0xf0a020,
                metalness: 0.75,
                roughness: 0.28,
              })
            )
            done(mesh)
          },
          undefined,
          (err) => {
            console.warn('STL load error:', path, err)
            done(new THREE.Mesh(
              new THREE.BoxGeometry(0.05, 0.05, 0.05),
              new THREE.MeshStandardMaterial({ color: 0xff0000 })
            ))
          }
        )
      })
    }

    loader.load(
      '/robot/kr210_r2700_2.urdf',
      (robot) => {
        if (cancelled) return

        // Scale: URDF is in metres, Three.js scene is also metres — no scale needed
        robot.rotation.set(0, 0, 0)
        robot.position.set(0, 0, 0)

        // Apply material to all meshes — KUKA orange + metallic
        robot.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xf0a020,
              metalness: 0.75,
              roughness: 0.28,
              envMapIntensity: 0.8,
            })
            child.castShadow = true
            child.receiveShadow = true
          }
        })

        scene.add(robot)
        robotRef.current = robot

        // Apply home angles
        applyAnglesToRobot(robot, HOME_ANGLES)

        useStore.setState({ robotRef: robot })
        setRobotLoaded(true)
        setRobotRef(robot)

        addLog('ok', 'KUKA KR210 R2700-2 loaded', { joints: JOINT_NAMES.length })
        addLog('info', 'URDF joints verified', Object.fromEntries(
          JOINT_NAMES.map((n) => [n, robot.joints[n] ? '✓' : '✗'])
        ))
      },
      undefined,
      (err) => {
        if (cancelled) return
        console.error('URDF load error:', err)
        addLog('error', `URDF load failed: ${err.message}`)
      }
    )

    return () => {
      cancelled = true
      if (robotRef.current) {
        scene.remove(robotRef.current)
      }
    }
  }, [])

  // Sync joint angles from store → robot
  useEffect(() => {
    const robot = robotRef.current || useStore.getState().robotRef
    if (!robot) return
    applyAnglesToRobot(robot, jointAngles)
  }, [jointAngles])

  return null
}
