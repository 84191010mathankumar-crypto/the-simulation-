import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  Environment,
  GizmoHelper,
  GizmoViewport,
  ContactShadows,
  SoftShadows,
} from '@react-three/drei'
import RobotArm from './RobotArm'
import WorkObject from './WorkObject'
import WorkingEnvelope from './WorkingEnvelope'
import AnimationController from './AnimationController'
import './SceneView.css'

/* Mounting plate — circular metal pedestal the robot bolts to */
function MountingPlate() {
  return (
    <group position={[0, 0, 0]}>
      {/* Main plate */}
      <mesh receiveShadow castShadow position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.55, 0.6, 0.05, 64]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.45} />
      </mesh>
      {/* Top bevel ring */}
      <mesh receiveShadow position={[0, 0.051, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.002, 64]} />
        <meshStandardMaterial color="#22252b" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* Bolt heads */}
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

export default function SceneView() {
  return (
    <div className="scene-view">
      <Canvas
        camera={{ position: [4.0, 2.6, 4.0], fov: 42, near: 0.01, far: 100 }}
        shadows
        gl={{ antialias: true, toneMapping: 3 /* ACESFilmic */ }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 0.85 }}
      >
        {/* Soft PCSS shadow filter */}
        <SoftShadows size={28} samples={16} focus={0.6} />

        {/* Lighting — bright key + soft fill */}
        <ambientLight intensity={0.35} />
        <hemisphereLight args={['#ffffff', '#dde4ef', 0.45]} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.1}
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
        <pointLight position={[-3, 4, -2]} intensity={0.35} color="#ffe9c8" />

        {/* Studio environment for nice reflections on orange metal */}
        <Environment preset="studio" background={false} environmentIntensity={0.7} />

        {/* Floor grid — light, subtle */}
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

        {/* Soft contact shadow under the robot */}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.55}
          scale={10}
          blur={2.6}
          far={4}
          resolution={1024}
          color="#1a1d24"
        />

        {/* Shadow-receiving floor */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <shadowMaterial opacity={0.18} />
        </mesh>

        {/* Mounting plate the robot sits on */}
        <MountingPlate />

        <Suspense fallback={null}>
          <RobotArm />
          <WorkObject objectKey="start" color="#ff6000" />
          <WorkObject objectKey="end"   color="#3b6fff" />
          <WorkingEnvelope />
          <AnimationController />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          makeDefault
          target={[0, 1.0, 0]}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={1.5}
          maxDistance={16}
          enableDamping
          dampingFactor={0.08}
        />

        {/* Orientation gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444','#10b981','#3b6fff']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      <div className="scene-hints">
        <span><b>LMB</b>orbit</span>
        <span><b>RMB</b>pan</span>
        <span><b>Scroll</b>zoom</span>
        <span><b>Click box</b>drag gizmo</span>
      </div>
    </div>
  )
}
