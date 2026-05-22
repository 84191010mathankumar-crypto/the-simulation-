import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import {
  RobotArm, AnimationController, RobotStoreProvider,
} from 'roboclaw'

/* ─── AGV chassis (same look as main demo's MobilePlatform) ─── */
function MobilePlatform() {
  return (
    <group>
      <mesh receiveShadow castShadow position={[0, 0.10, 0]}>
        <boxGeometry args={[1.10, 0.18, 0.80]} />
        <meshStandardMaterial color="#2b2d31" metalness={0.55} roughness={0.40} />
      </mesh>
      <mesh position={[0, 0.195, 0]}>
        <boxGeometry args={[1.105, 0.005, 0.805]} />
        <meshStandardMaterial color="#1a1c20" metalness={0.5} roughness={0.55} />
      </mesh>
      {[[-0.48, 0.34],[0.48, 0.34],[-0.48,-0.34],[0.48,-0.34]].map((p,i)=>(
        <mesh key={i} position={[p[0],0.06,p[1]]} rotation={[0,0,Math.PI/2]} castShadow>
          <cylinderGeometry args={[0.075,0.075,0.07,24]} />
          <meshStandardMaterial color="#111316" metalness={0.4} roughness={0.55} />
        </mesh>
      ))}
      <mesh receiveShadow castShadow position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.30, 0.32, 0.025, 32]} />
        <meshStandardMaterial color="#ff6000" metalness={0.30} roughness={0.50} />
      </mesh>
    </group>
  )
}

/* Drives a robot's outer group from its store's platformPose.  Same shape
 * as the main demo's `RobotBase`, just per-instance. */
function RobotOnPlatform({ store, robotColor }) {
  const baseRef = useRef()
  const setPlatformGroupRef = store((s) => s.setPlatformGroupRef)

  useEffect(() => {
    setPlatformGroupRef(baseRef.current || null)
    return () => setPlatformGroupRef(null)
  }, [setPlatformGroupRef])

  useFrame(() => {
    const g = baseRef.current
    if (!g) return
    const p = store.getState().platformPose
    g.position.set(p.position[0], p.position[1], p.position[2])
    g.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2])
  })

  return (
    <group ref={baseRef}>
      <MobilePlatform />
      {/* A coloured ring under the AGV so different robots are easy to tell apart */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[0.65, 0.78, 32]} />
        <meshBasicMaterial color={robotColor} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <RobotArm parentRef={baseRef} mountY={0.235} />
    </group>
  )
}

/* Static box rendered at world position.  The scheduler later reparents it
 * under a robot's gripper during 'grabbing'.
 *
 * We deliberately do NOT pass `position` as a JSX prop — R3F would re-apply
 * `box.from` on every render and undo the scheduler's reparenting.  Instead,
 * the position is set imperatively the first time the ref settles, and the
 * scheduler then owns the mesh's transform and parent for the rest of the run.
 */
function Box({ box, registerMeshRef }) {
  const ref = useRef()
  useEffect(() => {
    // IMPORTANT — register the actual THREE.Mesh (ref.current), NOT the ref
    // object.  The scheduler does `mesh.userData = ...`, `mesh.updateMatrixWorld()`
    // etc. directly on whatever was registered.
    registerMeshRef(box.id, ref.current)
    if (ref.current) {
      ref.current.position.set(box.from[0], box.from[1], box.from[2])
      const r = box.fromRotation || [0, 0, 0]
      ref.current.rotation.set(r[0], r[1], r[2])
    }
    return () => registerMeshRef(box.id, null)
  }, [box.id, registerMeshRef])
  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={box.size} />
      <meshStandardMaterial color="#c15f3c" metalness={0.1} roughness={0.7} />
    </mesh>
  )
}

/* Translucent target marker — where the box should end up. */
function TargetMarker({ box }) {
  const rot = box.toRotation || [0, 0, 0]
  return (
    <mesh position={box.to} rotation={rot}>
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color="#4a6ea3"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </mesh>
  )
}

/* Headless component that ticks the scheduler each frame. */
function SchedulerTick({ scheduler }) {
  useFrame(() => { scheduler.tick() })
  return null
}

/* Distinct per-robot accent colours. */
const ROBOT_COLORS = ['#ff6000','#3b82f6','#10b981','#a855f7','#f43f5e','#eab308','#06b6d4','#fb7185','#84cc16']

export default function WarehouseScene({ robots, boxes, scheduler, roomSize, registerMeshRef }) {
  return (
    <Canvas
      camera={{ position: [roomSize * 0.55, roomSize * 0.55, roomSize * 0.55], fov: 42, near: 0.1, far: 200 }}
      shadows
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
    >
      <hemisphereLight args={['#f4f6fa', '#d0d5dd', 0.80]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[roomSize * 0.4, roomSize * 0.7, roomSize * 0.3]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.1}
        shadow-camera-far={roomSize * 3}
        shadow-camera-left={-roomSize}
        shadow-camera-right={roomSize}
        shadow-camera-top={roomSize}
        shadow-camera-bottom={-roomSize}
      />

      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[roomSize, roomSize]} />
        <meshStandardMaterial color="#dde2eb" roughness={0.85} metalness={0.05} />
      </mesh>

      <Grid
        args={[roomSize, roomSize]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#b8c0cc"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#7a8390"
        fadeDistance={roomSize * 1.5}
        fadeStrength={1.2}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      {/* Room walls (thin, low) */}
      {[[ roomSize/2, 0, [0.1, 0.6, roomSize]],
        [-roomSize/2, 0, [0.1, 0.6, roomSize]],
        [0,  roomSize/2, [roomSize, 0.6, 0.1]],
        [0, -roomSize/2, [roomSize, 0.6, 0.1]]].map(([x, z, size], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color="#cbd1dc" />
        </mesh>
      ))}

      <Suspense fallback={null}>
        {robots.map((r, i) => (
          <RobotStoreProvider key={r.id} store={r.store}>
            <RobotOnPlatform store={r.store} robotColor={ROBOT_COLORS[i % ROBOT_COLORS.length]} />
            <AnimationController />
          </RobotStoreProvider>
        ))}

        {boxes.map((b) => <Box key={b.id} box={b} registerMeshRef={registerMeshRef} />)}
        {boxes.map((b) => <TargetMarker key={b.id + '-tgt'} box={b} />)}

        <SchedulerTick scheduler={scheduler} />
      </Suspense>

      <OrbitControls
        makeDefault
        target={[0, 0.5, 0]}
        maxPolarAngle={Math.PI * 0.495}
        minDistance={2}
        maxDistance={roomSize * 2}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
