import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import RectTool from './RectTool'
import PointTool from './PointTool'

/** Once the model's bounds are known, frame the camera around it. Runs only
 * the first time bounds become available — after that the user is free to
 * orbit/zoom without being yanked back. */
function CameraFit({ bounds }) {
  const { camera } = useThree()
  const didFit = useRef(false)

  useEffect(() => {
    if (!bounds || didFit.current) return
    didFit.current = true
    const radius = Math.max(bounds.size.x, bounds.size.z, bounds.size.y) || 20
    camera.position.set(
      bounds.center.x + radius * 0.8,
      radius * 0.7,
      bounds.center.z + radius * 0.8
    )
    camera.lookAt(bounds.center.x, 0, bounds.center.z)
  }, [bounds, camera])

  return null
}

/** Loads /model/model.gltf and reports its footprint once it's ready, so
 * the rest of the scene (ground plane, click-catchers, camera) can size
 * itself to fit. */
function SiteModel({ onBoundsReady }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}model/model.gltf`)

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    onBoundsReady({ size, center })
  }, [scene, onBoundsReady])

  return <primitive object={scene} />
}

function Loading() {
  return (
    <Html center>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6b7783',
        background: '#fff', padding: '8px 12px', borderRadius: 4, border: '1px solid #c8d0d7',
        whiteSpace: 'nowrap',
      }}>
        loading site model… (it's a big file, this can take a while)
      </div>
    </Html>
  )
}

export default function SitePlannerScene({
  activeTool, gantries, arms, grids, selectedId,
  onCreateGantry, onSelectGantry, onUpdateGantry,
  onCreateArm, onSelectArm, onUpdateArm,
  onCreateGrid, onSelectGrid, onUpdateGrid,
  onDeselect,
}) {
  const [bounds, setBounds] = useState(null)

  const groundSize = useMemo(() => {
    if (!bounds) return 40
    return Math.max(bounds.size.x, bounds.size.z) * 1.6 + 4
  }, [bounds])

  return (
    <div className="scene-wrap">
      <div className="scene-stamp">
        <div className="stamp-num">Fig. 04 / Site plan</div>
        <div className="stamp-title">Layout authoring</div>
        <div className="stamp-rule" />
      </div>
      <div className="scene-hud">
        <span className="hud-label">Viewport</span>
        <span className="hud-kbd"><kbd>drag</kbd> orbit</span>
        <span className="hud-kbd"><kbd>scroll</kbd> zoom</span>
        <span className="hud-kbd"><kbd>shift</kbd> pan</span>
      </div>
      <Canvas
        camera={{ position: [20, 16, 20], fov: 45, near: 0.1, far: 2000 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
      >
        <hemisphereLight args={['#f4f6fa', '#d0d5dd', 0.85]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[30, 40, 20]} intensity={1.3} />

        <Suspense fallback={<Loading />}>
          <SiteModel onBoundsReady={setBounds} />
        </Suspense>
        <CameraFit bounds={bounds} />

        <Grid
          args={[groundSize, groundSize]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#a0aab3"
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor="#7b8693"
          fadeDistance={groundSize}
          fadeStrength={1.6}
          followCamera={false}
          infiniteGrid={false}
          position={[0, 0.002, 0]}
        />

        <Suspense fallback={null}>
          <RectTool
            active={activeTool === 'gantry'}
            items={gantries}
            selectedId={activeTool === 'gantry' ? selectedId : null}
            color="#ff6000"
            y={0.10}
            groundSize={groundSize}
            onCreate={onCreateGantry}
            onSelect={onSelectGantry}
            onUpdate={onUpdateGantry}
            onDeselect={onDeselect}
          />
          <RectTool
            active={activeTool === 'grid'}
            items={grids}
            selectedId={activeTool === 'grid' ? selectedId : null}
            color="#1d4ed8"
            y={0.05}
            groundSize={groundSize}
            onCreate={onCreateGrid}
            onSelect={onSelectGrid}
            onUpdate={onUpdateGrid}
            onDeselect={onDeselect}
          />
          <PointTool
            active={activeTool === 'arm'}
            items={arms}
            selectedId={activeTool === 'arm' ? selectedId : null}
            color="#10b981"
            groundSize={groundSize}
            onCreate={onCreateArm}
            onSelect={onSelectArm}
            onUpdate={onUpdateArm}
            onDeselect={onDeselect}
          />
        </Suspense>

        <OrbitControls
          makeDefault
          target={bounds ? [bounds.center.x, 0, bounds.center.z] : [0, 0, 0]}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={1}
          maxDistance={groundSize * 2}
          enableDamping
          dampingFactor={0.08}
        />

        <GizmoHelper alignment="bottom-right" margin={[40, 40]}>
          <group scale={0.33}>
            <GizmoViewport axisColors={['#ef4444', '#10b981', '#3b6fff']} labelColor="white" />
          </group>
        </GizmoHelper>
      </Canvas>
    </div>
  )
}
