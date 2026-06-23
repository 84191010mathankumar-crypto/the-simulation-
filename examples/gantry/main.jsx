import React from 'react'
import ReactDOM from 'react-dom/client'
import GantryControlPanel from './GantryControlPanel'
import GantryScene from './GantryScene'
import '../../src/index.css'
import '../../src/App.css'

function App() {
  return (
    <div className="app-layout">
      <GantryControlPanel />
      <GantryScene />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
