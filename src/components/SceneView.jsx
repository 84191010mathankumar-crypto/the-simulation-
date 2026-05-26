import React, { Suspense, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
} from '@react-three/drei'
import * as THREE from 'three'
import { RobotArm, WorkObject, CarriedObject, AnimationController, useStore } from '../lib'
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

/* ─── Wrapper group that hosts robot + platform ─────────────
 *   Its transform is driven by `platformPose` from the store. The AnimationController
 *   writes to that pose during a Run sequence so the AGV drives to each target. */
function RobotBase({ mobileMode }) {
  const baseRef = useRef()
  const setPlatformGroupRef = useStore((s) => s.setPlatformGroupRef)

  // Expose the group to the store so the IK solver can probe it under
  // "future platform pose" hypotheticals.
  useEffect(() => {
    setPlatformGroupRef(baseRef.current || null)
    return () => setPlatformGroupRef(null)
  }, [setPlatformGroupRef, mobileMode])

  // Each frame, copy platformPose from the store into the group transform.
  useFrame(() => {
    const g = baseRef.current
    if (!g) return
    const { mobileMode: mm, platformPose: p } = useStore.getState()
    if (mm) {
      g.position.set(p.position[0], p.position[1], p.position[2])
      g.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2])
    } else if (g.position.x !== 0 || g.position.z !== 0 || g.rotation.y !== 0) {
      g.position.set(0, 0, 0)
      g.rotation.set(0, 0, 0)
    }
  })

  // Mount-disc top is at y=0.235 on the AGV; static pedestal sits at y=0.05.
  const robotLocalY = mobileMode ? 0.235 : 0.05

  return (
    <group ref={baseRef}>
      {mobileMode ? <MobilePlatform /> : <MountingPlate />}
      <RobotArm parentRef={baseRef} mountY={robotLocalY} />
    </group>
  )
}

export default function SceneView() {
  const mobileMode = useStore((s) => s.mobileMode)

  return (
    <div className="scene-view">
      <div className="scene-stamp">
        <div className="stamp-num">Fig. 01 / Workcell</div>
        <div className="stamp-title">Pick &amp; place</div>
        <div className="stamp-rule" />
      </div>
      <div className="scene-axes">
        <div className="ax-row"><span>X · forward</span><span className="swatch" style={{background:'#c34a3a'}}/></div>
        <div className="ax-row"><span>Y · up</span><span className="swatch" style={{background:'#4f7a5b'}}/></div>
        <div className="ax-row"><span>Z · lateral</span><span className="swatch" style={{background:'#2d5a78'}}/></div>
      </div>
      <div className="scene-hud">
        <span className="hud-label">Viewport</span>
        <span className="hud-kbd"><kbd>drag</kbd> orbit</span>
        <span className="hud-kbd"><kbd>scroll</kbd> zoom</span>
        <span className="hud-kbd"><kbd>shift</kbd> pan</span>
      </div>
      <Canvas
        camera={{ position: [4.0, 2.6, 4.0], fov: 42, near: 0.01, far: 100 }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
      >
        {/* Lighting — neutral cool whites, no warm tint */}
        <hemisphereLight args={['#f4f6fa', '#d0d5dd', 0.80]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.4}
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-camera-near={0.1}
          shadow-camera-far={40}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={6}
          shadow-camera-bottom={-2}
        />

        <Grid
          args={[18, 18]}
          cellSize={0.5}
          cellThickness={0.75}
          cellColor="#a0aab3"
          sectionSize={2}
          sectionThickness={1.2}
          sectionColor="#7b8693"
          fadeDistance={10}
          fadeStrength={1.8}
          fadeFrom={0}
          followCamera={false}
          infiniteGrid
          position={[0, 0.0005, 0]}
        />

        {/* Ground shadow receiver — sits just above the grid, no depth write so it never fights it */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial transparent opacity={0.3} depthWrite={false} />
        </mesh>

        {/* Overhead shadow-only light — points straight down, large radius → AO blob */}
        <directionalLight
          position={[0, 8, 0]}
          intensity={0.001}
          castShadow
          shadow-mapSize={[1048, 1048]}
          shadow-bias={-0.0003}
          shadow-radius={15}
          shadow-camera-near={0.5}
          shadow-camera-far={12}
          shadow-camera-left={-3.5}
          shadow-camera-right={3.5}
          shadow-camera-top={3.5}
          shadow-camera-bottom={-3.5}
        />

        <Suspense fallback={null}>
          <RobotBase mobileMode={mobileMode} />
          <WorkObject objectKey="start" color="#c79a7a" />
          <WorkObject objectKey="end"   color="#8aa0b6" />
          <CarriedObject color="#ebe4d2" />
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
