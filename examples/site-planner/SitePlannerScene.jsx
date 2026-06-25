import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  AnimationController, RobotStoreProvider,
  GantryRobot, GantryAnimationController, GantryStoreProvider,
} from 'robo-playground'
import RectTool from './RectTool'
import PointTool from './PointTool'
import LineTool from './LineTool'
import BuildResultTool from './BuildResultTool'
import SimBox from './SimBox'
import SimPanel from './SimPanel'
import PanelStorageVisual from './PanelStorageVisual'
import MobileArmRobot from '../warehouse/MobileArmRobot'
import { GantryRobotVisual, GridAreaVisual, StorageVisual } from './RobotVisuals'

const ROBOT_COLORS = ['#ff6000','#3b82f6','#10b981','#a855f7','#f43f5e','#eab308','#06b6d4','#fb7185','#84cc16']

/* Headless — ticks every active scheduler (arm fleet + gantries) each frame. */
function SchedulerTick({ schedulers }) {
  useFrame(() => { for (const s of schedulers) s.tick() })
  return null
}

/* Mobile arms, overhead gantries, and the carried boxes that run the build
 * during simulation.  Arms and gantries each have their own store + scheduler,
 * so they execute in parallel; every box mesh is shared and driven by whichever
 * scheduler owns it. */
function Simulation({ robots, gantryInstances, boxes, panelBoxes = [], schedulers, registerMeshRef }) {
  return (
    <Suspense fallback={null}>
      {robots.map((r, i) => (
        <RobotStoreProvider key={r.id} store={r.store}>
          <MobileArmRobot store={r.store} robotColor={ROBOT_COLORS[i % ROBOT_COLORS.length]} />
          <AnimationController />
        </RobotStoreProvider>
      ))}
      {gantryInstances.map((g) => (
        <GantryStoreProvider key={g.id} store={g.store}>
          <group position={[g.origin[0], 0, g.origin[1]]}>
            <GantryRobot travelX={g.travelX} travelZ={g.travelZ} />
          </group>
          <GantryAnimationController />
        </GantryStoreProvider>
      ))}
      {boxes.map((b) => <SimBox key={b.id} box={b} registerMeshRef={registerMeshRef} />)}
      {panelBoxes.map((b) => <SimPanel key={b.id} box={b} registerMeshRef={registerMeshRef} />)}
      <SchedulerTick schedulers={schedulers} />
    </Suspense>
  )
}

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

function SiteModel({ onBoundsReady, opacity = 1 }) {
  const { scene } = useGLTF(`${import.meta.env.BASE_URL}model/model-tex.gltf`)

  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)
    onBoundsReady({ size, center })
  }, [scene, onBoundsReady])

  useEffect(() => {
    scene.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach((m) => {
        // Only the flat satellite map material — leave buildings untouched
        if (m.name === 'kulture site (1)') {
          m.transparent = opacity < 1
          m.opacity = opacity
          m.needsUpdate = true
        }
      })
    })
  }, [scene, opacity])

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
  activeTool, gantries, arms, grids, zones, storageAreas,
  buildCubes, onAddBuildCube, onRemoveBuildCube,
  panels, panelSize = 2, placedPanelSegments, onCreatePanel, onSelectPanel, onDeletePanel,
  panelStorageAreas, consumedPanelSourceKeys,
  onCreatePanelStorage, onSelectPanelStorage, onUpdatePanelStorage, onDeletePanelStorage,
  simPanelBoxes = [],
  selectedId, showModel = true, modelOpacity = 1, gridSizeCm = 100, boxSizeCm = 60, isArmValid,
  simulating, simRobots, simBoxes, gantryInstances = [], activeGantryIds,
  consumedSourceKeys, schedulers = [], registerSimMeshRef,
  onCreateGantry, onSelectGantry, onUpdateGantry, onDeleteGantry,
  onCreateArm, onSelectArm, onUpdateArm,
  onCreateGrid, onSelectGrid, onUpdateGrid, onDeleteGrid,
  onCreateZone, onSelectZone, onUpdateZone, onDeleteZone,
  onCreateStorage, onSelectStorage, onUpdateStorage, onDeleteStorage,
  onDeselect,
}) {
  const [bounds, setBounds] = useState(null)
  const [autoOrbit, setAutoOrbit] = useState(true)

  const groundSize = useMemo(() => {
    if (bounds) return Math.max(bounds.size.x, bounds.size.z) * 1.6 + 4
    // When the site model is hidden, derive the floor plane size from the
    // actual scene items so clicks register across the full site footprint.
    const rects = [...gantries, ...grids]
    if (rects.length === 0) return 200
    const abs = rects.flatMap((r) => [Math.abs(r.minX), Math.abs(r.maxX), Math.abs(r.minZ), Math.abs(r.maxZ)])
    return Math.max(...abs) * 2 + 20
  }, [bounds, gantries, grids])

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

      <div className={`orbit-ctrl${autoOrbit ? ' active' : ''}`}>
        <span className="orbit-ctrl-icon">↻</span>
        <span className="orbit-ctrl-label">Auto Orbit</span>
        <button
          className={'orbit-switch' + (autoOrbit ? ' on' : '')}
          onClick={() => setAutoOrbit(v => !v)}
          aria-pressed={autoOrbit}
          aria-label="Toggle auto-orbit"
        >
          <span className="orbit-switch-thumb" />
        </button>
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

        {showModel && (
          <Suspense fallback={<Loading />}>
            <SiteModel onBoundsReady={setBounds} opacity={modelOpacity} />
          </Suspense>
        )}
        <CameraFit bounds={bounds} />

        <Suspense fallback={null}>
          {/* Gantry operating areas — orange outline, no fill + gantry bridge visual */}
          <RectTool
            active={activeTool === 'gantry'}
            items={gantries}
            selectedId={activeTool === 'gantry' ? null : selectedId}
            color="#ff6000"
            y={0.10}
            groundSize={groundSize}
            selectable={!activeTool}
            outlineOnly
            renderRobot={(rect) => (
              simulating && activeGantryIds && activeGantryIds.has(rect.id)
                ? null
                : <GantryRobotVisual rect={rect} />
            )}
            onCreate={onCreateGantry}
            onSelect={onSelectGantry}
            onUpdate={onUpdateGantry}
            onDelete={onDeleteGantry}
            onDeselect={onDeselect}
          />

          {/* Grid areas — dark grey outline, very transparent black bg with unit-grid lines */}
          <RectTool
            active={activeTool === 'grid'}
            items={grids}
            selectedId={activeTool === 'grid' ? null : selectedId}
            color="#3b3f44"
            y={0.05}
            groundSize={groundSize}
            selectable={!activeTool}
            outlineOnly
            renderRobot={(rect) => <GridAreaVisual rect={rect} gridSizeCm={gridSizeCm} />}
            onCreate={onCreateGrid}
            onSelect={onSelectGrid}
            onUpdate={onUpdateGrid}
            onDelete={onDeleteGrid}
            onDeselect={onDeselect}
          />

          {/* Restricted zones — red overlay */}
          <RectTool
            active={activeTool === 'zone'}
            items={zones}
            selectedId={activeTool === 'zone' ? null : selectedId}
            color="#dc2626"
            opacity={0.28}
            y={0.03}
            groundSize={groundSize}
            selectable={!activeTool}
            onCreate={onCreateZone}
            onSelect={onSelectZone}
            onUpdate={onUpdateZone}
            onDelete={onDeleteZone}
            onDeselect={onDeselect}
          />

          {/* Storage areas — brown outline, no fill + box fill */}
          <RectTool
            active={activeTool === 'storage'}
            items={storageAreas}
            selectedId={activeTool === 'storage' ? null : selectedId}
            color="#92400e"
            opacity={0.22}
            y={0.04}
            groundSize={groundSize}
            selectable={!activeTool}
            outlineOnly
            renderRobot={(rect) => (
              <StorageVisual
                rect={rect}
                gridSizeCm={boxSizeCm}
                hiddenKeys={simulating ? consumedSourceKeys : null}
              />
            )}
            onCreate={onCreateStorage}
            onSelect={onSelectStorage}
            onUpdate={onUpdateStorage}
            onDelete={onDeleteStorage}
            onDeselect={onDeselect}
          />

          {/* Robo arms.  While simulating they become mobile AGV-mounted arms
              that fetch boxes and build the pattern; otherwise they're the
              static placement markers used for authoring the plan. */}
          {simulating ? (
            <Simulation
              robots={simRobots}
              gantryInstances={gantryInstances}
              boxes={simBoxes}
              panelBoxes={simPanelBoxes}
              schedulers={schedulers}
              registerMeshRef={registerSimMeshRef}
            />
          ) : (
            <PointTool
              active={activeTool === 'arm'}
              items={arms}
              selectedId={activeTool === 'arm' ? null : selectedId}
              isValid={isArmValid}
              groundSize={groundSize}
              selectable={!activeTool}
              onCreate={onCreateArm}
              onSelect={onSelectArm}
              onUpdate={onUpdateArm}
              onDeselect={onDeselect}
            />
          )}

          {/* Panel storage — rectangles filled with lying-flat panels */}
          <RectTool
            active={activeTool === 'panelStorage'}
            items={panelStorageAreas || []}
            selectedId={activeTool === 'panelStorage' ? null : selectedId}
            color="#0891b2"
            opacity={0.22}
            y={0.06}
            groundSize={groundSize}
            selectable={!activeTool}
            outlineOnly
            renderRobot={(rect) => (
              <PanelStorageVisual
                rect={rect}
                panelSize={rect.panelSize || 2}
                hiddenKeys={simulating ? consumedPanelSourceKeys : null}
                selected={rect.id === selectedId}
                onUpdate={simulating ? null : (patch) => onUpdatePanelStorage(rect.id, patch)}
              />
            )}
            onCreate={onCreatePanelStorage}
            onSelect={onSelectPanelStorage}
            onUpdate={onUpdatePanelStorage}
            onDelete={onDeletePanelStorage}
            onDeselect={onDeselect}
          />

          {/* Panel target lines — floor outlines until robots place them */}
          <LineTool
            active={activeTool === 'panel'}
            items={panels || []}
            selectedId={activeTool === 'panel' ? null : selectedId}
            groundSize={groundSize}
            panelSize={panelSize}
            placedSegmentIds={placedPanelSegments}
            selectable={!activeTool}
            onCreate={onCreatePanel}
            onSelect={onSelectPanel}
            onDelete={onDeletePanel}
            onDeselect={onDeselect}
          />

          {/* Build result — transparent box stack visualization (the target
              pattern).  Edit buttons are disabled while simulating. */}
          <BuildResultTool
            active={!simulating && activeTool === 'build'}
            grids={grids}
            gridSizeCm={boxSizeCm}
            buildCubes={buildCubes}
            onAddCube={onAddBuildCube}
            onRemoveCube={onRemoveBuildCube}
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
          autoRotate={autoOrbit}
          autoRotateSpeed={1.5}
          enableZoom={true}
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
