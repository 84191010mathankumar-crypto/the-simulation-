/**
 * Static KUKA KR210 arm placed at a site-plan floor position.
 *
 * Loads the URDF once (module-level singleton), sets it to the home pose,
 * then clones that pre-posed hierarchy for every arm instance on the plan.
 * Shared materials across all clones keep GPU memory low.
 * No store/context required — display-only.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import URDFLoader from 'urdf-loader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/'
const URDF_PATH    = `${BASE}lib-assets/kr210/kr210_r2700_2.urdf`
const PACKAGE_DIR  = `${BASE}lib-assets/kr210`

// Arm folded upright — matches the "parked" home pose used by the full IK demo.
const HOME_ANGLES = {
  joint_1: 0,
  joint_2: -1.57,
  joint_3:  1.57,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
}

// Materials shared across all arm instances — created once.
const MAT_ORANGE     = new THREE.MeshStandardMaterial({ color: 0xff6000, metalness: 0.30, roughness: 0.50 })
const MAT_ANTHRACITE = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.55, roughness: 0.40 })
const MAT_CHARCOAL   = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.60, roughness: 0.35 })

function meshMaterial(path) {
  const file = path.split('/').pop().replace(/\.stl$/i, '').toLowerCase()
  if (file === 'base_link') return MAT_CHARCOAL
  if (file === 'link_6')    return MAT_ANTHRACITE
  return MAT_ORANGE
}

function makeLoadMeshCb() {
  return (path, manager, done) => {
    if (path.split('.').pop().toLowerCase() !== 'stl') {
      done(null, new Error(`Unsupported mesh: ${path}`))
      return
    }
    new STLLoader(manager).load(
      path,
      (geom) => {
        const mesh = new THREE.Mesh(geom, meshMaterial(path))
        mesh.castShadow    = true
        mesh.receiveShadow = true
        // Wrap in a Group so urdf-loader's material override (Mesh-only check) never fires.
        const wrap = new THREE.Group()
        wrap.add(mesh)
        done(wrap)
      },
      undefined,
      (err) => done(null, err),
    )
  }
}

// Module-level singleton — load once, resolve to the home-posed template.
let _templatePromise = null

function getTemplate() {
  if (_templatePromise) return _templatePromise
  _templatePromise = new Promise((resolve, reject) => {
    const loader = new URDFLoader()
    loader.packages    = { robot: PACKAGE_DIR }
    loader.loadMeshCb  = makeLoadMeshCb()
    loader.load(URDF_PATH, (robot) => {
      for (const [name, angle] of Object.entries(HOME_ANGLES)) {
        robot.joints?.[name]?.setJointValue(angle)
      }
      robot.updateMatrixWorld(true)
      resolve(robot)
    }, undefined, reject)
  })
  return _templatePromise
}

/**
 * Renders a static KUKA KR210 R2700-2 at the given floor position.
 * `valid`     — green ring when arm placement is legal, red when not.
 * `highlight` — raises ring opacity when the arm is selected in the panel.
 */
export default function PlacedKukaArm({ x, z, valid = true, highlight = false }) {
  const groupRef = useRef()

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    let clone = null
    let cancelled = false

    getTemplate()
      .then((template) => {
        if (cancelled || !groupRef.current) return
        // Deep-clone the pre-posed hierarchy. Shared geometries + materials.
        clone = template.clone(true)
        // URDF is ROS Z-up; rotate to Three.js Y-up, then lift onto pedestal.
        clone.rotation.set(-Math.PI / 2, 0, 0)
        clone.position.set(0, 0.05, 0)
        groupRef.current.add(clone)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (clone && groupRef.current) groupRef.current.remove(clone)
    }
  }, [])

  const ringColor = valid ? '#10b981' : '#dc2626'

  return (
    <group ref={groupRef} position={[x, 0, z]}>
      {/* Validity ring — green = on-grid & clear of restricted zones, red = invalid */}
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
