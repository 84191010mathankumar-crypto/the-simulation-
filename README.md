# roboclaw

A **React + Three.js** library + demo for simulating a 6-axis robot arm doing pick-and-place tasks, alone or in a coordinated fleet.

What you get out of the box:

- A KUKA **KR210 R2700-2** loaded from URDF, with proper colours and a parallel-jaw gripper.
- An **inverse-kinematics solver** so you can say "go pick that thing up" instead of dialling six joint angles by hand.
- A **pick-and-place state machine** that animates the move-grab-move-release-return sequence.
- A **mobile-platform** mode — the robot rides on an AGV that drives itself to within reach of the target.
- A **multi-robot coordinator** that auto-assigns scripted tasks to a fleet, with path-conflict avoidance.
- A polished **warehouse demo page** wiring all of the above together: 20 × 20 m room, slider for robot count, editable task list.

This repo contains both:

1. **The library** under [src/lib/](src/lib/) — the parts you reuse in any app.
2. **A warehouse demo app** under [src/warehouse/](src/warehouse/) — a Vite-powered single-page app that shows the library in action.  Open it, click Run, watch robots negotiate around each other.

> **Where this is going** — the goal is a larger app where **multiple robots roam a shared space and rebuild it by moving objects from A to B**.  The warehouse demo is the first cut.

---

## 1. Quick start — just want to see it run?

You don't need to know how to code for this part.  You do need [Node.js](https://nodejs.org/) (download the **LTS** version and install it with all the default options).

Open a terminal in the project folder and run:

```bash
npm install      # downloads everything the project needs (one-time, takes a minute)
npm run dev      # starts a local server and prints a URL
```

The terminal will show something like `Local: http://localhost:5173/` — open that link in your browser.  You'll see a 20 × 20 m warehouse with KUKA arms parked at the corners and six coloured crates scattered around the floor.

### What to try

| Action | What happens |
| --- | --- |
| Drag the **Active robots** slider | Change the fleet size from 1 to 6 robots before pressing Run. |
| Click **Run** | The coordinator assigns each robot the nearest unclaimed crate, drives there, picks it up, drives to the target zone (the dim outline), drops it. |
| Watch the side panel | Live counters (pending / active / done), per-robot task assignments, per-task progress. |
| Click **Stop** then **Reset** | Pauses or resets the demo. |

**Want to change the tasks?** Edit [src/warehouse/tasks.js](src/warehouse/tasks.js) — each entry is `{ id, label, from: [x, z], to: [x, z], size, color }`.  Add, remove, or move boxes around; Vite hot-reloads.

**Where's the original single-arm demo?**  The components live under [src/components/](src/components/) — to switch back, edit [src/App.jsx](src/App.jsx) per the comment in that file.

If something looks wrong — robots white, meshes missing — you probably haven't run `npm install` yet, or you're opening a stale tab.  Stop the server (`Ctrl+C` in the terminal), run `npm install`, then `npm run dev` again.

---

## 2. Repo layout

```
roboclaw/
├── README.md              ← you are here
├── package.json           ← npm metadata + scripts
├── vite.config.js         ← demo-app build config
├── index.html             ← demo entry point
│
├── public/
│   └── lib-assets/        ← runtime assets the library needs in the browser
│       └── kr210/         ← URDF + STL meshes for the KUKA KR210
│
└── src/
    ├── main.jsx           ← demo app bootstrap
    ├── App.jsx            ← demo entry — currently renders WarehouseApp
    │
    ├── components/        ← original single-arm demo (kept as reference)
    │   ├── ControlPanel.jsx
    │   └── SceneView.jsx
    │
    ├── warehouse/         ← THE WAREHOUSE DEMO ← multi-robot scene
    │   ├── WarehouseApp.jsx         ← top-level: panel + scene + coordinator
    │   ├── WarehouseScene.jsx       ← 20×20 m room, lighting, robots, boxes
    │   ├── WarehousePanel.jsx       ← side panel (slider, run/reset, task list)
    │   ├── tasks.js                 ← edit me: spawned crates + targets
    │   ├── useWarehouseCoordinator.js ← runtime: assigns + schedules + avoids
    │   ├── RobotInstance.jsx        ← one robot, own store, AGV-mounted
    │   ├── Platform.jsx             ← AGV chassis with per-robot accent disc
    │   ├── Room.jsx                 ← floor, walls, drop-zone outlines
    │   └── TaskBox.jsx              ← box that follows its task's state
    │
    └── lib/               ← THE LIBRARY ← reusable parts live here
        ├── index.js              ← public API barrel — `import { ... } from '...lib'`
        ├── components/
        │   ├── RobotArm.jsx
        │   ├── AnimationController.jsx
        │   ├── WorkObject.jsx
        │   └── WorkingEnvelope.jsx
        ├── state/
        │   ├── constants.js      ← joint names / limits / home pose / working area
        │   ├── store.jsx         ← createRobotStore factory + Context + hooks
        │   └── store.test.js
        ├── ik/
        │   ├── ikSolver.js       ← CCD inverse kinematics + grab-pose math
        │   └── ikSolver.test.js
        └── coordinator/          ← multi-robot primitives (pure functions)
            ├── geometry.js       ← 2D distance / segment-segment helpers
            ├── assign.js         ← greedy nearest-task assignment
            └── avoidance.js      ← path-conflict + parked-robot checks
```

**Rule of thumb:** if it's in [src/lib/](src/lib/), it's part of the library and stable.  If it's anywhere else under `src/`, it's demo-app glue that you should *not* depend on from a bigger project — copy it instead.

---

## 3. Using it as a library

There are two ways to consume the library, depending on where the consumer lives.

### 3a. From another project inside this repo (recommended for now)

The bigger "robots-rebuilding-a-space" app is intended to live in this same repo (say, under `src/app/` or `src/scenes/`).  From there you just import directly:

```jsx
import {
  RobotArm,
  AnimationController,
  WorkObject,
  WorkingEnvelope,
  RobotStoreProvider,
  createRobotStore,
  useRobotStore,
  useRobotStoreApi,
} from '../lib'   // <- this is the library entry point
```

You also need the bundled robot assets to be reachable via HTTP.  Because Vite serves everything under `public/` at the web root, the defaults (`/lib-assets/kr210/...`) already work.  Nothing to do.

#### Single robot — minimal scene

Every robot needs its own state.  Wrap the components for one arm in a `<RobotStoreProvider>` — without a `store` prop it creates one lazily:

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import {
  RobotArm, AnimationController, WorkObject,
  RobotStoreProvider,
} from './lib'

export default function MyScene() {
  return (
    <RobotStoreProvider>
      <Canvas camera={{ position: [4, 2.6, 4], fov: 42 }} shadows>
        <ambientLight intensity={0.7} />
        <directionalLight position={[6, 9, 5]} intensity={1.4} castShadow />

        <RobotArm mountY={0.05} />
        <WorkObject objectKey="start" color="#c15f3c" />
        <WorkObject objectKey="end"   color="#4a6ea3" />
        <AnimationController />

        <OrbitControls makeDefault target={[0, 1, 0]} />
      </Canvas>
    </RobotStoreProvider>
  )
}
```

Any UI button or panel that needs to read/write state:

```jsx
import { useRobotStore } from './lib'

function RunButton() {
  const setAnimState = useRobotStore((s) => s.setAnimState)
  return <button onClick={() => setAnimState('moving_to_start')}>Run</button>
}
```

#### Multiple robots in the same scene

Create one store per arm and wire each `<RobotStoreProvider>` to its own:

```jsx
import { useMemo } from 'react'
import {
  RobotArm, AnimationController, WorkObject,
  RobotStoreProvider, createRobotStore,
} from './lib'

export default function MultiRobotScene() {
  const armA = useMemo(() => createRobotStore(), [])
  const armB = useMemo(() => createRobotStore(), [])

  return (
    <Canvas>
      {/* … lights, controls … */}

      <RobotStoreProvider store={armA}>
        <group position={[-1.5, 0, 0]}>
          <RobotArm />
          <WorkObject objectKey="start" color="#c15f3c" />
          <WorkObject objectKey="end"   color="#4a6ea3" />
          <AnimationController />
        </group>
      </RobotStoreProvider>

      <RobotStoreProvider store={armB}>
        <group position={[1.5, 0, 0]}>
          <RobotArm />
          <WorkObject objectKey="start" color="#10b981" />
          <WorkObject objectKey="end"   color="#3b6fff" />
          <AnimationController />
        </group>
      </RobotStoreProvider>
    </Canvas>
  )
}
```

Each provider scope is independent — joint angles, animation state, logs, and work-object poses are stored separately.  Control panels can target a specific arm by holding the store directly (e.g. `armA.getState().setAnimState('moving_to_start')`).

### 3b. As an npm package (later)

The `package.json` already declares the right `main` / `module` / `exports`, but the package is currently marked `"private": true` and there is **no separate bundling step** — you'd be importing the `.jsx` source files directly.  That's fine inside this repo (Vite handles JSX); it won't work in a CRA / Next / non-Vite consumer until you add a bundler (`tsup` / `vite build --lib` / `rollup`).

When you're ready to publish:

1. Drop `"private": true` from `package.json`.
2. Add a `build:lib` script (e.g. `vite build --lib`) and point `main`/`module` at the built output.
3. Run `npm publish`.

---

## 4. Configuration: pointing the arm at different assets

Both asset paths are props on `<RobotArm>`, with sensible defaults pointing at the bundled KR210:

```jsx
import { RobotArm, KR210_DEFAULT_URDF, KR210_DEFAULT_PACKAGE_DIR } from './lib'

<RobotArm
  urdfPath={KR210_DEFAULT_URDF}                  // '/lib-assets/kr210/kr210_r2700_2.urdf'
  packagePath={KR210_DEFAULT_PACKAGE_DIR}        // '/lib-assets/kr210'
  mountY={0.05}                                  // height above the parent group
/>
```

Want to host the assets somewhere else (CDN, different folder, mounted from another package)?  Override both props.  The URDF's `package://robot/...` mesh references resolve against `packagePath`.

To use a **different URDF entirely** — e.g. a UR5 or a Franka Panda — drop the URDF + meshes into your own `public/...` location and pass the new paths.  You'll likely need to adjust `JOINT_NAMES` and `JOINT_LIMITS` in [src/lib/state/useStore.js](src/lib/state/useStore.js) to match the new robot.

---

## 5. The public API (cheat-sheet)

Everything below is exported from `roboclaw` (i.e. `src/lib/index.js`):

### Components

| Name | What it is |
| --- | --- |
| `RobotArm` | Loads a URDF, attaches the gripper, exposes the robot via the store. |
| `AnimationController` | Headless R3F component that drives the pick-and-place sequence and (in mobile mode) the AGV pose. |
| `WorkObject` | Draggable box + 3D gizmo representing a pick-or-place target. |
| `WorkingEnvelope` | Transparent cylinder visualising the robot's reachable workspace. |

### State (Zustand factory + React Context)

| Name | What it is |
| --- | --- |
| `createRobotStore()` | Factory returning an isolated, per-robot Zustand store. |
| `<RobotStoreProvider store={...}>` | Context provider that scopes child components to one store.  Omit `store` to auto-create. |
| `useRobotStore(selector?)` | Hook to read state and subscribe to changes.  `useRobotStore(s => s.jointAngles)`. |
| `useRobotStoreApi()` | Returns the raw store handle (`.getState()`, `.setState()`, `.subscribe(selector, cb)`).  Use this inside `useFrame` / `useEffect` when you don't want re-renders. |
| `JOINT_NAMES` | `['joint_1', ..., 'joint_6']`. |
| `JOINT_LIMITS` | URDF joint limits in radians. |
| `HOME_ANGLES` | Default joint pose. |
| `WORKING_AREA` | `{ radius, minZ, maxZ }` for the reach envelope. |

The store is built with the `subscribeWithSelector` middleware, so `store.subscribe(selector, listener)` works as documented for hot-path updates (e.g. applying joint angles to the URDF every frame without forcing a React render).

### Inverse-kinematics primitives

| Name | What it is |
| --- | --- |
| `solveCCDIK(robot, targetPos, targetZ, ...)` | Orientation-aware multi-restart cyclic-coordinate-descent IK.  Returns joint angles or `null`. |
| `computeGrabPose(pos, rot, grabVec)` | Computes the face centre + tool-axis direction for a given object pose. |
| `getToolPose(robot)` | Current world pose of the gripper pinch point. |
| `applyAnglesToRobot` / `readAnglesFromRobot` | Sync `{joint_1: rad, ...}` to/from the loaded URDF. |
| `clampJoint` / `clampAllJoints` | Snap angles into the URDF limits. |
| `lerpAngles` / `easeInOutCubic` | Helpers for smooth interpolation. |

### Multi-robot coordinator primitives

| Name | What it is |
| --- | --- |
| `assignNearestPending(idleRobots, pendingTasks)` | Greedy nearest-pickup assignment; never gives two robots the same task. |
| `pathConflicts(start, end, reservations, safetyDistance)` | Returns true if a planned segment passes within `safetyDistance` of any reserved segment. |
| `pathClearOfRobots(start, end, parkedPositions, safetyDistance)` | Like above but for stationary robots (zero-length segments). |
| `dist2D`, `pointSegmentDistance`, `segmentSegmentDistance` | The geometric primitives both of the above are built from. |

---

## 5a. Warehouse demo internals

The demo is wired in roughly four layers:

1. **Tasks** ([tasks.js](src/warehouse/tasks.js)) — a plain JS array of `{ from, to, size, color, label }`.  Edit this file to add or move work.
2. **Robots** ([RobotInstance.jsx](src/warehouse/RobotInstance.jsx)) — each robot is its own `<RobotStoreProvider store={...}>` containing a `<RobotArm>` + `<AnimationController>` + AGV chassis.  Stores are stable across slider changes so a robot keeps its identity if you scale the fleet up and down.
3. **Coordinator** ([useWarehouseCoordinator.js](src/warehouse/useWarehouseCoordinator.js)) — a polled state machine that:
   - notices when a robot's `animState` is `idle` and gives it the closest pending task (greedy assignment via `assignNearestPending`)
   - reserves the segment the robot is *currently driving*, and refuses to start a new task whose drive-to-pickup or pickup-to-dropoff legs cross a reservation within `SAFETY_DISTANCE` (1.4 m today)
   - writes `startObject` / `endObject` / `setAnimState('moving_to_start')` into the robot's store to kick off the existing pick-and-place pipeline
   - releases reservations when the robot returns to idle, freeing those lanes for others
4. **Visuals** ([TaskBox.jsx](src/warehouse/TaskBox.jsx), [Room.jsx](src/warehouse/Room.jsx)) — each box positions itself every frame: resting at `from` while pending, glued to the carrier robot's gripper while in transit, resting at `to` when done.

**Limitations (honest list).**  Today the avoidance is geometric only — it doesn't reason about *time* (a robot that's about to finish its leg is treated the same as one that just started).  This is fine for the current demo because legs are short and re-checked every 150 ms, but if you push to 6+ robots crowding the centre of the floor you can see brief stalls.  Better schemes (time-windowed reservations, CBS, velocity obstacles) plug into [src/lib/coordinator/avoidance.js](src/lib/coordinator/avoidance.js).

## 6. Architecture notes

- **State is a per-robot Zustand store** produced by `createRobotStore()` and threaded through `<RobotStoreProvider>`.  This is what makes multi-robot scenes possible — each provider is an isolated scope with its own joint angles, animation state, logs, etc.  Constants like joint limits and home pose live in [src/lib/state/constants.js](src/lib/state/constants.js), not the store, so the IK math has no runtime-state dependency.
- **IK is iterative CCD** — fast, no inverse-Jacobian, robust to limits.  It restarts from several seed poses to avoid local minima.  Expect occasional misses on awkward orientations.
- **The URDF loader is `urdf-loader` v0.12.x** — we override `loadMeshCb` so we can apply our own KUKA-orange / anthracite materials instead of its default white phong.
- **Mobile mode plumbing** lives in `SceneView.RobotBase` (demo) and `AnimationController._solveSegment` (lib).  The platform's THREE.Group is registered into the store so the IK solver can run with a *hypothetical* future platform pose, then restore.

## 6a. Running the tests

```bash
npm test            # one-shot run (CI / pre-push)
npm run test:watch  # interactive watcher during development
```

Tests cover:

- the store factory (independence between robots, action behaviour, `subscribeWithSelector` semantics)
- the pure IK helpers (`clampJoint`, `lerpAngles`, `easeInOutCubic`, `computeGrabPose`)
- the coordinator primitives (`assignNearestPending`, `pathConflicts`, `pathClearOfRobots`, segment-segment math)

67 tests, ~300 ms.

There is also a **headless browser smoke test** that exercises the warehouse demo end-to-end — boots the dev server, clicks Run, watches the counters tick from 0 to 6 done, and saves screenshots to `scripts/`:

```bash
# In one terminal:
npm run dev
# In another, once the server is up:
PORT=<port-vite-printed> node scripts/smoke.mjs
```

What is **not** tested:
- The full URDF load path (`urdf-loader` needs a DOM + network — covered by the dev-server smoke test).
- `solveCCDIK` end-to-end convergence (would require a loaded robot — covered by visual inspection in the demo).

Add tests next to the file they exercise, named `*.test.js` — Vitest picks them up automatically.

---

## 7. Roadmap

- [x] **Multi-robot support** — factory + Context done.  See "Multiple robots in the same scene" above.
- [x] **Warehouse-scale demo** — 20×20 m room, scripted tasks, runtime coordinator, slider-controlled fleet.
- [ ] **Spatial state on refs, not in the store** — joint angles + 3D objects live as plain Three.js mutables; the store keeps only UI-facing state (animState, logs, follow mode).  Cuts re-renders in the hot path.  *(Started but deferred to keep the warehouse demo focused — see [src/lib/state/store.jsx](src/lib/state/store.jsx).)*
- [ ] **Time-windowed reservations** in the avoidance layer — today's geometric check is correct but conservative.  CBS or velocity obstacles slot into [src/lib/coordinator/avoidance.js](src/lib/coordinator/avoidance.js).
- [ ] **Higher-level scene primitives** — a `<RobotOnPlatform>` wrapper extracted from the demo's `RobotBase`.
- [ ] **Bundled lib build** (`tsup` or `vite build --lib`) so the package is consumable outside Vite.
- [ ] **Programmatic task API** — `runPickAndPlace({ from, to })` returning a Promise, instead of poking the animState string.
- [ ] **Collision checks** between arm/platform/world (today we coordinate AGV paths, not arm sweep volumes).

---

## 8. License

MIT.  (Add an actual `LICENSE` file before you publish anything.)
