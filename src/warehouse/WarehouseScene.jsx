import React, { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OrbitControls, Grid, GizmoHelper, GizmoViewport, Environment,
} from '@react-three/drei'
import * as THREE from 'three'
import RobotInstance, { useRobotInstances } from './RobotInstance.jsx'
import Room, { TargetZone } from './Room.jsx'
import TaskBox from './TaskBox.jsx'
import { ROBOT_DOCKS, ROOM_SIZE } from './tasks.js'
import './WarehouseScene.css'

/**
 * Top-level 3D scene for the warehouse demo.  All robots, the room, and the
 * task boxes live inside one Canvas.  The coordinator that drives them is
 * managed by the parent (WarehouseApp), which forwards a snapshot down via
 * `taskSnapshot`.
 *
 * Robots are pre-instantiated (one per dock) so that toggling the slider
 * "active count" just decides which robots get rendered — the stores
 * themselves are stable, which keeps the runtime coordinator happy.
 */
export default function WarehouseScene({ robots, activeCount, tasks, taskSnapshot }) {
  const activeRobots = useMemo(() => robots.slice(0, activeCount), [robots, activeCount])

  return (
    <div className="warehouse-scene">
      <Canvas
        camera={{ position: [14, 11, 14], fov: 45, near: 0.1, far: 120 }}
        shadows
        gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
        onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
      >
        {/* Lighting — cool neutral whites, matching the single-arm demo */}
        <hemisphereLight args={['#f4f6fa', '#d0d5dd', 0.85]} />
        <ambientLight intensity={0.60} />
        <directionalLight
          position={[12, 18, 8]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00015}
          shadow-normalBias={0.025}
          shadow-camera-near={0.1}
          shadow-camera-far={60}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />

        {/* Subtle floor grid drawn UNDER the room floor — adds a sense of scale */}
        <Grid
          args={[ROOM_SIZE * 1.5, ROOM_SIZE * 1.5]}
          cellSize={1}
          cellThickness={0.4}
          cellColor="#cfd5e0"
          sectionSize={5}
          sectionThickness={0.9}
          sectionColor="#a8b0c0"
          fadeDistance={ROOM_SIZE * 1.2}
          fadeStrength={1.4}
          followCamera={false}
          infiniteGrid={false}
          position={[0, -0.001, 0]}
        />

        <Room size={ROOM_SIZE} />

        {/* Drop-zone markers for every task — show where each box should land */}
        {tasks.map((t) => (
          <TargetZone key={t.id} position={t.to} size={t.size} color={t.color} />
        ))}

        <Suspense fallback={null}>
          {/* Robots — only the first `activeCount` get rendered */}
          {activeRobots.map((r) => (
            <RobotInstance key={r.id} store={r.store} dock={r.dock} color={r.color} />
          ))}

          {/* Boxes — re-position themselves every frame based on task status */}
          {tasks.map((t) => (
            <TaskBox
              key={t.id}
              task={t}
              robots={activeRobots}
              status={taskSnapshot.taskStatus[t.id]}
              carriedByRobotId={taskSnapshot.carriedBy[t.id]}
            />
          ))}
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 0.8, 0]}
          maxPolarAngle={Math.PI * 0.49}
          minDistance={3}
          maxDistance={45}
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

export { ROBOT_DOCKS }
