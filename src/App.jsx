import React from 'react'
import ControlPanel from './components/ControlPanel'
import SceneView from './components/SceneView'
import './App.css'

export default function App() {
  return (
    <div className="app-layout">
      <ControlPanel />
      <SceneView />
    </div>
  )
}
