import React, { useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import Panel from './Panel'
import JsonBar from './JsonBar'
import SitePlannerScene from './SitePlannerScene'
import '../warehouse/Panel.css'
import './site-planner.css'

const round = (n) => Math.round(n * 100) / 100

function App() {
  const [gantries, setGantries] = useState([])
  const [arms, setArms] = useState([])
  const [grids, setGrids] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const nextId = useRef({ gantry: 1, arm: 1, grid: 1 })
  const makeId = (type) => `${type}-${nextId.current[type]++}`

  // ── Gantry areas (rect) ────────────────────────────────────────────
  const onCreateGantry = (rect) => {
    setGantries((g) => [...g, { id: makeId('gantry'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateGantry = (id, rect) =>
    setGantries((g) => g.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectGantry = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteGantry = (id) => {
    setGantries((g) => g.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  // ── Robo arms (point) ──────────────────────────────────────────────
  const onCreateArm = (point) => {
    setArms((a) => [...a, { id: makeId('arm'), ...point }])
    setActiveTool(null)
  }
  const onUpdateArm = (id, point) =>
    setArms((a) => a.map((it) => (it.id === id ? { ...it, ...point } : it)))
  const onSelectArm = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteArm = (id) => {
    setArms((a) => a.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  // ── Grid areas (rect) ──────────────────────────────────────────────
  const onCreateGrid = (rect) => {
    setGrids((g) => [...g, { id: makeId('grid'), ...rect }])
    setActiveTool(null)
  }
  const onUpdateGrid = (id, rect) =>
    setGrids((g) => g.map((it) => (it.id === id ? { ...it, ...rect } : it)))
  const onSelectGrid = (id) => setSelectedId((cur) => (cur === id ? null : id))
  const onDeleteGrid = (id) => {
    setGrids((g) => g.filter((it) => it.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }

  const onDeselect = () => setSelectedId(null)

  const config = useMemo(() => ({
    gantryRobots: gantries.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
    roboArms: arms.map(({ id, x, z }) => ({ id, x: round(x), z: round(z) })),
    grids: grids.map(({ id, minX, maxX, minZ, maxZ }) => ({
      id, minX: round(minX), maxX: round(maxX), minZ: round(minZ), maxZ: round(maxZ),
    })),
  }), [gantries, arms, grids])

  return (
    <div className="planner-app">
      <div className="planner-top">
        <Panel
          gantries={gantries} arms={arms} grids={grids}
          activeTool={activeTool} setActiveTool={setActiveTool}
          selectedId={selectedId}
          onSelectGantry={onSelectGantry} onDeleteGantry={onDeleteGantry}
          onSelectArm={onSelectArm} onDeleteArm={onDeleteArm}
          onSelectGrid={onSelectGrid} onDeleteGrid={onDeleteGrid}
        />
        <SitePlannerScene
          activeTool={activeTool}
          gantries={gantries} arms={arms} grids={grids}
          selectedId={selectedId}
          onCreateGantry={onCreateGantry} onSelectGantry={onSelectGantry} onUpdateGantry={onUpdateGantry}
          onCreateArm={onCreateArm} onSelectArm={onSelectArm} onUpdateArm={onUpdateArm}
          onCreateGrid={onCreateGrid} onSelectGrid={onSelectGrid} onUpdateGrid={onUpdateGrid}
          onDeselect={onDeselect}
        />
      </div>
      <JsonBar config={config} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
