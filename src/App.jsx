import React from 'react'
import WarehouseApp from './warehouse/WarehouseApp.jsx'
import './App.css'

/**
 * Demo entry — boots the multi-robot warehouse scene.
 *
 * The original single-arm dev panel still lives at:
 *   src/components/ControlPanel.jsx
 *   src/components/SceneView.jsx
 * To switch back, replace the import below with:
 *   import { RobotStoreProvider } from './lib'
 *   import ControlPanel from './components/ControlPanel'
 *   import SceneView from './components/SceneView'
 *   …and render <RobotStoreProvider><ControlPanel /><SceneView /></RobotStoreProvider>.
 */
export default function App() {
  return <WarehouseApp />
}
