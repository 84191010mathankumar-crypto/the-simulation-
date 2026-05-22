# robo-playground

A browser playground for a 6-axis **KUKA KR210** robot arm — built with **React + Three.js**.

Two demos in one app:

- **Single arm** — drag two pose targets around and watch the arm pick from one and place at the other. Toggle **Mobile platform** and the arm rides an AGV that drives itself to within reach.
- **Warehouse** — a swarm of robots assembles a house (or a ziggurat) from scattered crates in a 20 × 20 m room. Pick a scenario, set the fleet size, hit Start.

- Live: **<https://hellguz.github.io/robo-playground/>**
- Warehouse demo: **<https://hellguz.github.io/robo-playground/examples/warehouse/>**

---

## Run it locally

You need [Node.js](https://nodejs.org/) (LTS).

```bash
npm install
npm run dev
```

Open the URL the terminal prints (usually `http://localhost:5173/`). The warehouse demo is at `/examples/warehouse/`.

---

## What to try

**Single arm:**

| | |
| --- | --- |
| Drag a gizmo on a box | Moves the start/end target. Toggle **Follow** to have the arm live-track it. |
| **Run** | Move to start → grab → move to end → release → return. |
| **Mobile platform** | Robot rides an AGV that drives itself near each target. |
| **Home** | Snap the arm back to its home pose. |

**Warehouse:** pick a scenario, set the robot count, click **Start**. **Reset** puts every crate back. The code editor lets you write a custom scenario in JS — the scene updates as you type.

---

## Repo layout

```
src/lib/              ← the reusable library (RobotArm, IK solver, store, …)
src/                  ← single-arm demo app
examples/warehouse/   ← multi-robot demo + scenarios in script.js
public/lib-assets/    ← KR210 URDF + STL meshes
```

If it's in `src/lib/`, it's the library. Everything else is demo glue — copy, don't import.

---

## Using the library

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { RobotArm, AnimationController, WorkObject } from './lib'

export default function MyScene() {
  return (
    <Canvas camera={{ position: [4, 2.6, 4], fov: 42 }} shadows>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 9, 5]} intensity={1.4} castShadow />
      <RobotArm mountY={0.05} />
      <WorkObject objectKey="start" color="#c15f3c" />
      <WorkObject objectKey="end"   color="#4a6ea3" />
      <AnimationController />
      <OrbitControls makeDefault target={[0, 1, 0]} />
    </Canvas>
  )
}
```

Trigger a run from anywhere:

```js
import { useStore } from './lib'
useStore.getState().setAnimState('moving_to_start')
```

### Custom robot or asset path

`<RobotArm>` accepts `urdfPath` and `packagePath` props (defaults point at the bundled KR210). For a different robot, also update `JOINT_NAMES` / `JOINT_LIMITS` in `src/lib/state/useStore.js`.

---

## Public API

Exported from `src/lib/index.js`:

- **Components:** `RobotArm`, `AnimationController`, `WorkObject`, `WorkingEnvelope`
- **Store:** `useStore`, `JOINT_NAMES`, `JOINT_LIMITS`, `HOME_ANGLES`, `WORKING_AREA`
- **IK:** `solveCCDIK`, `computeGrabPose`, `getToolPose`, `applyAnglesToRobot`, `readAnglesFromRobot`, `clampJoint`, `clampAllJoints`, `lerpAngles`, `easeInOutCubic`

---

## Deployment

Pushing to `main` / `master` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`. The Vite `base` switches to `/robo-playground/` automatically in CI.

---

## License

MIT.
