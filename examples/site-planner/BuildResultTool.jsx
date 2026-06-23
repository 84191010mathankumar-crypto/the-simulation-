import React, { useMemo, useRef, useEffect } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const _dummy = new THREE.Object3D()
const MAX_CELLS = 30000

function computeEmptyCells(grids, unit, groundOccupied) {
  const map = new Map()
  for (const grid of grids) {
    const cols = Math.floor((grid.maxX - grid.minX) / unit)
    const rows = Math.floor((grid.maxZ - grid.minZ) / unit)
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = Math.round((grid.minX + (i + 0.5) * unit) * 1000) / 1000
        const z = Math.round((grid.minZ + (j + 0.5) * unit) * 1000) / 1000
        const key = `${x}:${z}`
        if (!groundOccupied.has(key)) map.set(key, { x, z })
      }
    }
  }
  return Array.from(map.values())
}

/** Transparent box visualization for the build result, with stacking support. */
export default function BuildResultTool({ active, grids, gridSizeCm, buildCubes, onAddCube, onRemoveCube }) {
  const unit = gridSizeCm / 100
  const s = unit * 0.92

  const occupiedKey = useMemo(() => {
    const set = new Set()
    for (const c of buildCubes) set.add(`${c.x}:${c.z}:${c.layer}`)
    return set
  }, [buildCubes])

  const groundOccupied = useMemo(() => {
    const set = new Set()
    for (const c of buildCubes) if (c.layer === 0) set.add(`${c.x}:${c.z}`)
    return set
  }, [buildCubes])

  const emptyCells = useMemo(
    () => (active ? computeEmptyCells(grids, unit, groundOccupied) : []),
    [active, grids, unit, groundOccupied]
  )

  const hRef = useRef()
  const vRef = useRef()
  const fillRef = useRef()
  const wireRef = useRef()

  const plusLen = Math.max(0.12, unit * 0.4)
  const plusThick = Math.max(0.04, unit * 0.07)

  // Draw every placed cube with two instanced meshes (a faint fill + a
  // wireframe) instead of two THREE meshes per cube.  A tall build is hundreds
  // of cubes; collapsing them into two draw calls is what keeps the viewport
  // (and the box-moving animation on top of it) smooth.
  useEffect(() => {
    const fill = fillRef.current
    const wire = wireRef.current
    if (!fill || !wire) return
    const n = Math.min(buildCubes.length, MAX_CELLS)
    for (let i = 0; i < n; i++) {
      const cube = buildCubes[i]
      _dummy.position.set(cube.x, cube.layer * unit + unit / 2, cube.z)
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.set(1, 1, 1)
      _dummy.updateMatrix()
      fill.setMatrixAt(i, _dummy.matrix)
      wire.setMatrixAt(i, _dummy.matrix)
    }
    fill.count = n
    wire.count = n
    fill.instanceMatrix.needsUpdate = true
    wire.instanceMatrix.needsUpdate = true
  }, [buildCubes, unit])

  useEffect(() => {
    if (!hRef.current || !vRef.current) return
    const n = Math.min(emptyCells.length, MAX_CELLS)
    hRef.current.count = n
    vRef.current.count = n
    for (let i = 0; i < n; i++) {
      const { x, z } = emptyCells[i]
      _dummy.position.set(x, 0.04, z)
      _dummy.rotation.set(0, 0, 0)
      _dummy.scale.set(1, 1, 1)
      _dummy.updateMatrix()
      hRef.current.setMatrixAt(i, _dummy.matrix)
      vRef.current.setMatrixAt(i, _dummy.matrix)
    }
    hRef.current.instanceMatrix.needsUpdate = true
    vRef.current.instanceMatrix.needsUpdate = true
  }, [emptyCells])

  function handleFloorPlusClick(e) {
    e.stopPropagation()
    const cell = emptyCells[e.instanceId]
    if (cell) onAddCube(cell.x, cell.z, 0)
  }

  return (
    <group>
      {/* Floor-level + markers at empty grid cells — instanced for performance */}
      {active && (
        <>
          <instancedMesh
            ref={hRef}
            args={[undefined, undefined, MAX_CELLS]}
            onPointerDown={handleFloorPlusClick}
            frustumCulled={false}
          >
            <boxGeometry args={[plusLen, 0.03, plusThick]} />
            <meshBasicMaterial color="#3b6fff" transparent opacity={0.7} depthWrite={false} />
          </instancedMesh>
          <instancedMesh
            ref={vRef}
            args={[undefined, undefined, MAX_CELLS]}
            frustumCulled={false}
          >
            <boxGeometry args={[plusThick, 0.03, plusLen]} />
            <meshBasicMaterial color="#3b6fff" transparent opacity={0.7} depthWrite={false} />
          </instancedMesh>
        </>
      )}

      {/* Placed cubes — drawn as two instanced meshes (fill + wireframe). */}
      {buildCubes.length > 0 && (
        <>
          <instancedMesh
            key={`fill-${buildCubes.length}`}
            ref={fillRef}
            args={[undefined, undefined, Math.min(buildCubes.length, MAX_CELLS)]}
            frustumCulled={false}
          >
            <boxGeometry args={[s, s, s]} />
            <meshStandardMaterial color="#3b6fff" transparent opacity={0.2} depthWrite={false} />
          </instancedMesh>
          <instancedMesh
            key={`wire-${buildCubes.length}`}
            ref={wireRef}
            args={[undefined, undefined, Math.min(buildCubes.length, MAX_CELLS)]}
            frustumCulled={false}
          >
            <boxGeometry args={[s, s, s]} />
            <meshStandardMaterial color="#3b82f6" wireframe />
          </instancedMesh>
        </>
      )}

      {/* Edit-mode +/− buttons — only while editing (never during a run), so
          the per-cube DOM overlays don't cost anything during simulation. */}
      {active && buildCubes.map((cube) => {
        const y = cube.layer * unit + unit / 2
        const isTop = !occupiedKey.has(`${cube.x}:${cube.z}:${cube.layer + 1}`)
        return (
          <group key={cube.id} position={[cube.x, y, cube.z]}>
            {isTop && (
              <Html position={[0, s / 2 + 0.04, 0]} center zIndexRange={[200, 0]}>
                <button
                  className="build-btn build-add"
                  onPointerDown={(e) => { e.stopPropagation(); onAddCube(cube.x, cube.z, cube.layer + 1) }}
                >+</button>
              </Html>
            )}
            <Html position={[s * 0.52, s * 0.52, -s * 0.52]} center zIndexRange={[200, 0]}>
              <button
                className="build-btn build-del"
                onPointerDown={(e) => { e.stopPropagation(); onRemoveCube(cube.id) }}
              >−</button>
            </Html>
          </group>
        )
      })}
    </group>
  )
}
