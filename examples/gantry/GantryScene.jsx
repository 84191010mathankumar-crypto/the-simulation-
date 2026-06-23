import React, { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import GantryRobot from '../../src/lib/gantry/GantryRobot'
import GantryWorkObject from '../../src/lib/gantry/GantryWorkObject'
import GantryCarriedObject from '../../src/lib/gantry/GantryCarriedObject'
import GantryAnimationController from '../../src/lib/gantry/GantryAnimationController'
import '../../src/components/SceneView.css'

export default function GantryScene() {
  return (
    <div className="scene-view">
      <div className="scene-stamp">
        <div className="stamp-num">Fig. 01 / Workcell</div>
        <div className="stamp-title">Gantry pick &amp; place</div>
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
        camera={{ position: [4.4, 3.0, 4.4], fov: 42, near: 0.01, far: 100 }}
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
      >
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

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial transparent opacity={0.3} depthWrite={false} />
        </mesh>

        <Suspense fallback={null}>
          <GantryRobot />
          <GantryWorkObject objectKey="start" color="#c79a7a" />
          <GantryWorkObject objectKey="end"   color="#8aa0b6" />
          <GantryCarriedObject color="#ebe4d2" />
          <GantryAnimationController />
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
