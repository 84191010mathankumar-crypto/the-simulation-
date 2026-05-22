import React, { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Edges, ContactShadows } from '@react-three/drei'
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
    return () => registerMeshRef(box.id, null)
  }, [box.id, registerMeshRef])
  // Re-apply pickup pose whenever from/fromRotation change (live custom-script
  // edits mutate these without changing box.id, so the registration effect
  // above does not re-fire).
  const [fx, fy, fz] = box.from
  const fr = box.fromRotation || [0, 0, 0]
  const [rx, ry, rz] = fr
  useEffect(() => {
    if (!ref.current) return
    ref.current.position.set(fx, fy, fz)
    ref.current.rotation.set(rx, ry, rz)
  }, [fx, fy, fz, rx, ry, rz])
  return (
    <mesh ref={ref} castShadow receiveShadow key={box.size.join(',')}>
      <boxGeometry args={box.size} />
      <meshStandardMaterial color="#ffffff" metalness={0.04} roughness={0.78} />
      <Edges color="#1a1f27" threshold={12} lineWidth={1} />
    </mesh>
  )
}

/* Translucent target marker — where the box should end up. */
function TargetMarker({ box }) {
  const rot = box.toRotation || [0, 0, 0]
  return (
    <mesh position={box.to} rotation={rot} key={box.size.join(',')}>
      <boxGeometry args={box.size} />
      <meshStandardMaterial
        color="#ffffff"
        transparent
        opacity={0.10}
        depthWrite={false}
      />
      <Edges color="#6b7783" threshold={12} lineWidth={1} />
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
    <div className="scene-wrap">
      <div className="scene-stamp">
        <div className="stamp-num">Fig. 02 / Floor plan</div>
        <div className="stamp-title">Multi-fleet workcell</div>
        <div className="stamp-rule" />
      </div>
      <div className="scene-meta">
        <div className="num">{String(robots.length).padStart(2,'0')}</div>
        <div>{robots.length === 1 ? 'unit' : 'units'} dispatched</div>
      </div>
    <Canvas
      camera={{ position: [roomSize * 0.55, roomSize * 0.55, roomSize * 0.55], fov: 42, near: 0.1, far: 200 }}
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMappingExposure = 1.15 }}
    >
      <hemisphereLight args={['#f4f6fa', '#d0d5dd', 0.80]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[roomSize * 0.4, roomSize * 0.7, roomSize * 0.3]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
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
        <meshStandardMaterial color="#e3e8ec" roughness={0.92} metalness={0.0} />
      </mesh>

      <Grid
        args={[roomSize, roomSize]}
        cellSize={1}
        cellThickness={0.75}
        cellColor="#a0aab3"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#7b8693"
        fadeDistance={roomSize * 0.8}
        fadeStrength={1.6}
        fadeFrom={0}
        followCamera={false}
        infiniteGrid={false}
        position={[0, 0.001, 0]}
      />

      <ContactShadows
        position={[0, 0.002, 0]}
        opacity={0.42}
        scale={roomSize}
        blur={2.4}
        far={6}
        resolution={512}
        color="#0e1620"
      />

      {/* Room walls (thin, low) */}
      {[[ roomSize/2, 0, [0.1, 0.6, roomSize]],
        [-roomSize/2, 0, [0.1, 0.6, roomSize]],
        [0,  roomSize/2, [roomSize, 0.6, 0.1]],
        [0, -roomSize/2, [roomSize, 0.6, 0.1]]].map(([x, z, size], i) => (
        <mesh key={i} position={[x, 0.3, z]}>
          <boxGeometry args={size} />
          <meshStandardMaterial color="#d0d6dc" roughness={0.9} />
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
    </div>
  )
}
