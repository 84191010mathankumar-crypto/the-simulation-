import React from 'react'
import { RobotStoreProvider } from './lib'
import ControlPanel from './components/ControlPanel'
import SceneView from './components/SceneView'
import './App.css'

export default function App() {
  // One robot, one store.  For a multi-robot demo, create stores explicitly
  // and wrap each robot's components in its own <RobotStoreProvider store={...}>.
  return (
    <RobotStoreProvider>
      <div className="app-layout">
        <ControlPanel />
        <SceneView />
      </div>
    </RobotStoreProvider>
  )
}
