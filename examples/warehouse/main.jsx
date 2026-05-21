/**
 * examples/warehouse — entry point for the bigger multi-robot demo.
 *
 * Today this is a stub: it imports from the roboclaw lib (resolved via the
 * Vite alias in this folder's vite.config.js) and renders a placeholder.
 *
 * The intent is for this file to grow into a small "warehouse" scene with
 *   - a floor / shelves / pickup zones,
 *   - several `<RobotArm>` instances on `MobilePlatform` AGVs,
 *   - a task queue that assigns boxes A → B to the nearest free robot.
 *
 * NOTE — the current lib ships a SINGLE-ROBOT singleton store
 * (src/lib/state/useStore.js).  Before multiple arms can coexist in this
 * scene, that store needs to become a factory (one store per arm).
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { JOINT_NAMES, WORKING_AREA } from 'roboclaw'

function Placeholder() {
  return (
    <div className="placeholder">
      <div>
        <h1>warehouse demo — stub</h1>
        <p>
          The lib resolves: <code>{JOINT_NAMES.length} joints</code>,&nbsp;
          <code>reach {WORKING_AREA.radius} m</code>.
        </p>
        <p>Next: drop in <code>&lt;Canvas&gt;</code>, several robots, a task queue.</p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Placeholder />
  </React.StrictMode>,
)
