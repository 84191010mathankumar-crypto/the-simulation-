import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import RobotArm from './RobotArm'
import WorkObject from './WorkObject'
import WorkingEnvelope from './WorkingEnvelope'
import AnimationController from './AnimationController'
import './SceneView.css'

export default function SceneView() {
  return (
    <div className="scene-view">
      <Canvas
        camera={{ position: [3.5, 2.8, 3.5], fov: 44, near: 0.01, far: 100 }}
        shadows="soft"
        gl={{ antialias: true, toneMapping: 3 /* ACESFilmic */ }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 0.9 }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.1}
          shadow-camera-far={40}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={5}
          shadow-camera-bottom={-2}
        />
        <pointLight position={[-3, 5, -2]} intensity={0.5} color="#ffcc66" />

        {/* Environment map — warm tone so orange reads clearly */}
        <Environment preset="city" background={false} />

        {/* Floor grid */}
        <Grid
          args={[14, 14]}
          cellSize={0.5}
          cellThickness={0.4}
          cellColor="#252836"
          sectionSize={1}
          sectionThickness={0.8}
          sectionColor="#363a4f"
          fadeDistance={16}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
          position={[0, -0.001, 0]}
        />

        {/* Shadow catcher */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.3} />
        </mesh>

        <Suspense fallback={null}>
          <RobotArm />
          <WorkObject objectKey="start" color="#f0a500" />
          <WorkObject objectKey="end"   color="#3b82f6" />
          <WorkingEnvelope />
          <AnimationController />
        </Suspense>

        {/* Camera controls — orbit around arm centre of mass */}
        <OrbitControls
          makeDefault
          target={[0, 1.0, 0]}
          maxPolarAngle={Math.PI * 0.88}
          minDistance={0.5}
          maxDistance={14}
        />

        {/* Orientation gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444','#22c55e','#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      <div className="scene-hints">
        <span>LMB: orbit</span>
        <span>RMB: pan</span>
        <span>Scroll: zoom</span>
        <span>Click box → drag gizmo</span>
      </div>
    </div>
  )
}
