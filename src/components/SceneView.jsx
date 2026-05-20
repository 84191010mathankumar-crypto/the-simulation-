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
        camera={{ position: [3.5, 2.5, 3.5], fov: 45, near: 0.01, far: 100 }}
        shadows
        gl={{ antialias: true }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.1}
          shadow-camera-far={30}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />
        <pointLight position={[-3, 4, -3]} intensity={0.4} color="#3b82f6" />

        {/* Floor grid */}
        <Grid
          args={[12, 12]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#252836"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#363a4f"
          fadeDistance={15}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
          position={[0, -0.001, 0]}
        />

        {/* Shadow catcher */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.25} />
        </mesh>

        <Suspense fallback={null}>
          <RobotArm />
          <WorkObject objectKey="start" color="#f0a500" />
          <WorkObject objectKey="end"   color="#3b82f6" />
          <WorkingEnvelope />
          <AnimationController />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          makeDefault
          target={[0, 0.8, 0]}
          maxPolarAngle={Math.PI * 0.85}
          minDistance={0.5}
          maxDistance={12}
        />

        {/* Orientation gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#ef4444','#22c55e','#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {/* Overlay hints */}
      <div className="scene-hints">
        <span>LMB drag: orbit</span>
        <span>RMB drag: pan</span>
        <span>Scroll: zoom</span>
        <span>Click object to select + drag gizmo</span>
      </div>
    </div>
  )
}
