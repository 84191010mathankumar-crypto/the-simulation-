import React, { Suspense, useRef, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  Environment,
  GizmoHelper,
  GizmoViewport,
  ContactShadows,
  PivotControls,
} from '@react-three/drei'
import * as THREE from 'three'
import RobotArm from './RobotArm'
import WorkObject from './WorkObject'
import WorkingEnvelope from './WorkingEnvelope'
import AnimationController from './AnimationController'
import useStore from '../store/useStore'
import './SceneView.css'

/* ─── Static pedestal — bolted, circular, doesn't move ─────── */
function MountingPlate() {
  return (
    <group position={[0, 0, 0]}>
      <mesh receiveShadow castShadow position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.05, 64]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh receiveShadow position={[0, 0.051, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.002, 64]} />
        <meshStandardMaterial color="#22252b" metalness={0.5} roughness={0.55} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        const r = 0.52
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.053, Math.sin(a) * r]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.008, 8]} />
            <meshStandardMaterial color="#1a1c20" metalness={0.8} roughness={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ─── Mobile AGV platform — wider chassis with wheels ──────── */
function MobilePlatform() {
  return (
    <group>
      {/* Chassis */}
      <mesh receiveShadow castShadow position={[0, 0.10, 0]}>
        <boxGeometry args={[1.10, 0.18, 0.80]} />
        <meshStandardMaterial color="#2b2d31" metalness={0.55} roughness={0.40} />
      </mesh>
      {/* Top trim strip */}
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[1.105, 0.005, 0.805]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* 4 wheels */}
      {[
        [-0.48,  0.34],
        [ 0.48,  0.34],
        [-0.48, -0.34],
        [ 0.48, -0.34],
      ].map((p, i) => (
        <mesh key={i} position={[p[0], 0.06, p[1]]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.07, 24]} />
          <meshStandardMaterial color="#111316" metalness={0.4} roughness={0.55} />
        </mesh>
      ))}
      {/* Robot mounting disc */}
      <mesh receiveShadow castShadow position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.30, 0.32, 0.025, 32]} />
        <meshStandardMaterial color="#ff6000" metalness={0.30} roughness={0.50} />
      </mesh>
      {/* Bolts on mount disc */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2
        const r = 0.275
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.224, Math.sin(a) * r]} castShadow>
            <cylinderGeometry args={[0.013, 0.013, 0.007, 8]} />
            <meshStandardMaterial color="#1a1c20" metalness={0.8} roughness={0.3} />
          </mesh>
        )
      })}
      {/* Front LiDAR / sensor tower */}
      <mesh castShadow position={[0.50, 0.23, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.08, 16]} />
        <meshStandardMaterial color="#0e1014" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0.50, 0.27, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
        <meshStandardMaterial color="#3b6fff" metalness={0.3} roughness={0.4} emissive="#3b6fff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

/* ─── Wrapper group that hosts robot + platform; transformed by store ─── */
function RobotBase({ mobileMode, platformPose, setPlatformPose }) {
  const baseRef = useRef()

  // Initial gumball matrix for the AGV — only used when mobile mode is on
  const initialMatrix = useMemo(() => {
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3(...platformPose.position)
    const e = new THREE.Euler(
      platformPose.rotation[0],
      platformPose.rotation[1],
      platformPose.rotation[2],
      'XYZ',
    )
    m.compose(p, new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1))
    return m
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileMode])   // recompute when toggling mode (so the gumball resets)

  // Write the platform's new pose into the store as the user drags it.
  // We keep it on the floor (y locked to 0) and only allow yaw rotation.
  const onPlatformDrag = useCallback((world) => {
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()
    world.decompose(pos, quat, scl)
    const eul = new THREE.Euler().setFromQuaternion(quat, 'YXZ')
    setPlatformPose({
      position: [pos.x, 0, pos.z],   // y pinned to floor
      rotation: [0, eul.y, 0],       // only yaw
    })
  }, [setPlatformPose])

  // Mount-disc top is at y=0.235 on the AGV; the static pedestal sits at y=0.05.
  // We pass the robot a parent group and offset its local Y so its base lands
  // on whichever surface is rendered.
  const robotLocalY = mobileMode ? 0.235 : 0.05

  const baseContent = (
    <group ref={baseRef}>
      {mobileMode ? <MobilePlatform /> : <MountingPlate />}
      <RobotArm parentRef={baseRef} mountY={robotLocalY} />
    </group>
  )

  if (!mobileMode) return baseContent

  return (
    <PivotControls
      scale={70}
      fixed
      lineWidth={2}
      depthTest={false}
      anchor={[0, 0, 0]}
      activeAxes={[true, false, true]}    // XZ translate only (no Y)
      disableSliders                       // no plane handles
      matrix={initialMatrix}
      autoTransform
      onDrag={onPlatformDrag}
    >
      {baseContent}
    </PivotControls>
  )
}

export default function SceneView() {
  const mobileMode      = useStore((s) => s.mobileMode)
  const platformPose    = useStore((s) => s.platformPose)
  const setPlatformPose = useStore((s) => s.setPlatformPose)

  return (
    <div className="scene-view">
      <Canvas
        camera={{ position: [4.0, 2.6, 4.0], fov: 42, near: 0.01, far: 100 }}
        shadows
        gl={{ antialias: true, toneMapping: 3 /* ACESFilmic */ }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.65
          gl.shadowMap.type = THREE.PCFSoftShadowMap
        }}
      >
        {/* Lighting — bright key + soft fill */}
        <ambientLight intensity={0.22} />
        <hemisphereLight args={['#ffffff', '#dde4ef', 0.28]} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={0.7}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-camera-near={0.1}
          shadow-camera-far={40}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={6}
          shadow-camera-bottom={-2}
        />
        <pointLight position={[-3, 4, -2]} intensity={0.20} color="#ffe9c8" />

        <Environment preset="studio" background={false} environmentIntensity={0.45} />

        <Grid
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#cfd5e0"
          sectionSize={2}
          sectionThickness={1.0}
          sectionColor="#a8b0c0"
          fadeDistance={18}
          fadeStrength={1.2}
          followCamera={false}
          infiniteGrid
          position={[0, 0.0005, 0]}
        />

        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.55}
          scale={mobileMode ? 14 : 10}
          blur={2.6}
          far={4}
          resolution={1024}
          color="#1a1d24"
        />

        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.18} />
        </mesh>

        <Suspense fallback={null}>
          <RobotBase
            mobileMode={mobileMode}
            platformPose={platformPose}
            setPlatformPose={setPlatformPose}
          />
          <WorkObject objectKey="start" color="#c15f3c" />
          <WorkObject objectKey="end"   color="#4a6ea3" />
          <WorkingEnvelope />
          <AnimationController />
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 1.0, 0]}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={1.5}
          maxDistance={16}
          enableDamping
          dampingFactor={0.08}
        />

        <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
          <group scale={0.33}>
            <GizmoViewport axisColors={['#ef4444','#10b981','#3b6fff']} labelColor="white" />
          </group>
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
