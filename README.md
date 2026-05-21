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

> **Where this is going** — the goal is a larger app where **multiple robots roam a shared space and rebuild it by moving objects from A to B**.  This repo will host that app too: a stub for it lives at [examples/warehouse/](examples/warehouse/) and is the intended home for the multi-robot scene.  The boundary between *library* and *the bigger project* is the [src/lib/](src/lib/) folder.

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

### Running the warehouse example

The same `npm run dev` server also serves a second page at **[/examples/warehouse/](http://localhost:5173/examples/warehouse/)** — a multi-robot pick-and-place demo in a 20 × 20 m room.  Open the URL in your browser; no extra command needed.

- Move the **Robots** slider (1–6) to pick how many arms are in the scene.
- Click **Start**.  The scheduler assigns each box to the robot whose AGV is currently closest, and the robots execute the same pick → grab → move → release → return sequence as the main demo.
- Click **Reset** to put every box back and re-arm the run.

**Defining your own scenario:** edit [examples/warehouse/script.js](examples/warehouse/script.js).  Each box is one line:

```js
{ id: 'A',           // any unique string
  size: [w, h, d],   // box dimensions in metres
  from: [x, y, z],   // world position at scene start
  to:   [x, y, z],   // world position where you want it placed
  grab: [gx, gy, gz] // unit vector in the box's LOCAL frame pointing OUT of
                     // the face the gripper approaches.  [0,1,0] = top.
},
```

Save the file and the dev server hot-reloads the scene.

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
├── examples/
│   └── warehouse/         ← stub for the bigger multi-robot scene
│       ├── index.html
│       ├── main.jsx
│       └── vite.config.js
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
        │   └── useStore.js   ← Zustand store (joint angles, anim state, etc.)
        └── ik/
            └── ikSolver.js   ← CCD inverse kinematics + grab-pose math
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
  useStore,
} from '../lib'   // <- this is the library entry point
```

You also need the bundled robot assets to be reachable via HTTP.  Because Vite serves everything under `public/` at the web root, the defaults (`/lib-assets/kr210/...`) already work.  Nothing to do.

A minimal scene:

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { RobotArm, AnimationController, WorkObject } from './lib'

export default function MyScene() {
  return (
    <Canvas camera={{ position: [4, 2.6, 4], fov: 42 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 5]} intensity={1.4} castShadow />

      {/* one robot arm at the world origin */}
      <RobotArm mountY={0.05} />

      {/* two draggable pose targets */}
      <WorkObject objectKey="start" color="#c15f3c" />
      <WorkObject objectKey="end"   color="#4a6ea3" />

      {/* drives the pick-and-place state machine */}
      <AnimationController />

      <OrbitControls makeDefault target={[0, 1, 0]} />
    </Canvas>
  )
}
```

Then anywhere else (a button, an effect):

```jsx
import { useStore } from './lib'

function RunButton() {
  const start = () => useStore.getState().setAnimState('moving_to_start')
  return <button onClick={start}>Run</button>
}
```

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

### State (Zustand store)

| Name | What it is |
| --- | --- |
| `useStore` | The global store hook.  Read with `useStore(s => s.jointAngles)`, write with `useStore.setState({...})` or via actions like `setAnimState`, `setStartObject`, `setMobileMode`. |
| `JOINT_NAMES` | `['joint_1', ..., 'joint_6']`. |
| `JOINT_LIMITS` | URDF joint limits in radians. |
| `HOME_ANGLES` | Default joint pose. |
| `WORKING_AREA` | `{ radius, minZ, maxZ }` for the reach envelope. |

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

- **State is held in a Zustand singleton** (`useStore`).  This is fine for one robot per page; it is the **one thing that needs to change** to support multiple robots in the same scene.  Converting `useStore` into a factory (`createRobotStore()` returning a fresh store per arm) is the planned refactor.
- **IK is iterative CCD** — fast, no inverse-Jacobian, robust to limits.  It restarts from several seed poses to avoid local minima.  Expect occasional misses on awkward orientations.
- **The URDF loader is `urdf-loader` v0.12.x** — we override `loadMeshCb` so we can apply our own KUKA-orange / anthracite materials instead of its default white phong.
- **Mobile mode plumbing** lives in `SceneView.RobotBase` (demo) and `AnimationController._solveSegment` (lib).  The platform's THREE.Group is registered into the store so the IK solver can run with a *hypothetical* future platform pose, then restore.

---

## 7. Roadmap

- [ ] **Multi-robot support** — convert `useStore` into a factory; pass a `storeInstance` prop to each `<RobotArm>` / `<AnimationController>`.
- [ ] **Higher-level scene primitives** — a `<RobotOnPlatform>` wrapper extracted from the demo's `RobotBase`.
- [ ] **Bundled lib build** (`tsup` or `vite build --lib`) so the package is consumable outside Vite.
- [ ] **Programmatic task API** — `runPickAndPlace({ from, to })` returning a Promise, instead of poking the animState string.
- [ ] **Collision checks** between arm/platform/world.

---

## 8. License

MIT.  (Add an actual `LICENSE` file before you publish anything.)
