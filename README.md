# roboclaw

A small **React + Three.js** library that puts a real, motion-accurate 6-axis robot arm into your browser.  Out of the box it gives you:

- A KUKA **KR210 R2700-2** loaded from URDF, with proper colours and a parallel-jaw gripper.
- An **inverse-kinematics solver** so you can say "go pick that thing up" instead of dialling six joint angles by hand.
- A **pick-and-place state machine** that animates the move-grab-move-release-return sequence.
- Optional **mobile platform** mode — the robot rides on an AGV that drives itself to within reach of the target.
- Draggable **start / end pose targets** with a 3D gizmo.

The repo contains both:

1. **The library** under [src/lib/](src/lib/) — the parts you reuse in any app.
2. **A demo app** at the repo root — a Vite-powered single-page app that shows the library in action.  The demo is also a reference implementation: copy it as the starting point for your own scene.

> **Where this is going** — the goal is a larger app where **multiple robots roam a shared space and rebuild it by moving objects from A to B**.  This repo will host that app too; the boundary between *library* and *the bigger project* is the [src/lib/](src/lib/) folder.

---

## 1. Quick start — just want to see it run?

You don't need to know how to code for this part.  You do need [Node.js](https://nodejs.org/) (download the **LTS** version and install it with all the default options).

Open a terminal in the project folder and run:

```bash
npm install      # downloads everything the project needs (one-time, takes a minute)
npm run dev      # starts a local server and prints a URL
```

The terminal will show something like `Local: http://localhost:5173/` — open that link in your browser.  You should see the orange robot on a circular pedestal, with two coloured boxes (orange = **start**, blue = **end**).

### What to try

| Action | What happens |
| --- | --- |
| Drag the colored gizmo on a box | The box moves.  Toggle **Follow start / Follow end** and the arm will live-track it. |
| Click **Run** | Robot moves to start → grabs → moves to end → releases → returns home. |
| Tick **Mobile platform** | Robot now sits on an AGV chassis.  It drives itself near each target before reaching. |
| Click **Home** | Arm snaps back to the home pose. |

If something looks wrong — robot is white, meshes missing — you almost certainly haven't run `npm install` yet, or you're opening a stale tab.  Stop the server (`Ctrl+C` in the terminal), run `npm install`, then `npm run dev` again.

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
    ├── App.jsx            ← demo app shell (ControlPanel + SceneView)
    ├── components/        ← demo-only UI (control panel, scene wrapper)
    │   ├── ControlPanel.jsx
    │   └── SceneView.jsx
    │
    └── lib/               ← THE LIBRARY ← reusable parts live here
        ├── index.js          ← public API barrel — `import { ... } from '...lib'`
        ├── components/
        │   ├── RobotArm.jsx
        │   ├── AnimationController.jsx
        │   ├── WorkObject.jsx
        │   └── WorkingEnvelope.jsx
        ├── state/
        │   ├── constants.js  ← joint names / limits / home pose / working area
        │   ├── store.jsx     ← createRobotStore factory + Context + hooks
        │   └── store.test.js
        └── ik/
            ├── ikSolver.js   ← CCD inverse kinematics + grab-pose math
            └── ikSolver.test.js
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

---

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

Tests cover the store factory (independence between robots, action behaviour, `subscribeWithSelector` semantics) and the pure IK helpers (`clampJoint`, `lerpAngles`, `easeInOutCubic`, `computeGrabPose`).  37 tests, ~700 ms.

What is **not** tested:
- The full URDF load path (`urdf-loader` needs a DOM + network — covered by the dev-server smoke test).
- `solveCCDIK` end-to-end convergence (would require a loaded robot — covered by visual inspection in the demo).

Add tests next to the file they exercise, named `*.test.js` — Vitest picks them up automatically.

---

## 7. Roadmap

- [x] **Multi-robot support** — factory + Context done.  See "Multiple robots in the same scene" above.
- [ ] **Spatial state on refs, not in the store** — joint angles + 3D objects live as plain Three.js mutables; the store keeps only UI-facing state (animState, logs, follow mode).  Cuts re-renders in the hot path.
- [ ] **Higher-level scene primitives** — a `<RobotOnPlatform>` wrapper extracted from the demo's `RobotBase`.
- [ ] **Bundled lib build** (`tsup` or `vite build --lib`) so the package is consumable outside Vite.
- [ ] **Programmatic task API** — `runPickAndPlace({ from, to })` returning a Promise, instead of poking the animState string.
- [ ] **Collision checks** between arm/platform/world.

---

## 8. License

MIT.  (Add an actual `LICENSE` file before you publish anything.)
