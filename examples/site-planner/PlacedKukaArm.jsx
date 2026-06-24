/**
 * Static KUKA KR210 arm placed at a site-plan floor position.
 *
 * Loads a fresh URDF per instance (same pattern as RobotArm.jsx in the main
 * demo).  The browser caches the STL files after the first fetch, so
 * subsequent arms load from memory.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import URDFLoader from 'urdf-loader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/'
const URDF_PATH   = `${BASE}lib-assets/kr210/kr210_r2700_2.urdf`
const PACKAGE_DIR = `${BASE}lib-assets/kr210`

const HOME_ANGLES = {
  joint_1: 0,
  joint_2: -1.57,
  joint_3:  1.57,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
}

const MAT_ORANGE     = new THREE.MeshStandardMaterial({ color: 0xff6000, metalness: 0.30, roughness: 0.50 })
const MAT_ANTHRACITE = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.55, roughness: 0.40 })
const MAT_CHARCOAL   = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.60, roughness: 0.35 })

function meshMaterial(path) {
  const file = path.split('/').pop().replace(/\.stl$/i, '').toLowerCase()
  if (file === 'base_link') return MAT_CHARCOAL
  if (file === 'link_6')    return MAT_ANTHRACITE
  return MAT_ORANGE
}

export default function PlacedKukaArm({ x, z, valid = true, highlight = false }) {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    let cancelled = false
    let robot = null

    const loader = new URDFLoader()
    loader.packages = { robot: PACKAGE_DIR }
    loader.loadMeshCb = (path, manager, done) => {
      if (!path.toLowerCase().endsWith('.stl')) {
        done(null, new Error(`Unsupported: ${path}`))
        return
      }
      new STLLoader(manager).load(
        path,
        (geom) => {
          const mesh = new THREE.Mesh(geom, meshMaterial(path))
          mesh.castShadow    = true
          mesh.receiveShadow = true
          const wrap = new THREE.Group()
          wrap.add(mesh)
          done(wrap)
        },
        undefined,
        (err) => {
          console.error('PlacedKukaArm STL load failed:', path, err)
          done(null, err)
        },
      )
    }

    loader.load(
      URDF_PATH,
      (urdfRobot) => {
        if (cancelled) return
        for (const [name, angle] of Object.entries(HOME_ANGLES)) {
          urdfRobot.joints?.[name]?.setJointValue(angle)
        }
        urdfRobot.updateMatrixWorld(true)
        // URDF is ROS Z-up → rotate to Three.js Y-up, lift above pedestal
        urdfRobot.rotation.set(-Math.PI / 2, 0, 0)
        urdfRobot.position.set(0, 0.05, 0)
        group.add(urdfRobot)
        robot = urdfRobot
      },
      undefined,
      (err) => console.error('PlacedKukaArm URDF load failed:', err),
    )

    return () => {
      cancelled = true
      if (robot) group.remove(robot)
    }
  }, [])

  const ringColor = valid ? '#10b981' : '#dc2626'

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Validity ring — green = on-grid & clear of zones, red = invalid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.35, 0.55, 32]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={highlight ? 0.95 : 0.65}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
