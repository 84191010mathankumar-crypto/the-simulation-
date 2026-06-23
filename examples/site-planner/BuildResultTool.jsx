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

  const plusLen = Math.max(0.12, unit * 0.4)
  const plusThick = Math.max(0.04, unit * 0.07)

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

      {/* Placed cubes — always visible, buttons only in edit mode */}
      {buildCubes.map((cube) => {
        const y = cube.layer * unit + unit / 2
        const isTop = !occupiedKey.has(`${cube.x}:${cube.z}:${cube.layer + 1}`)
        return (
          <group key={cube.id} position={[cube.x, y, cube.z]}>
            {/* Transparent fill */}
            <mesh>
              <boxGeometry args={[s, s, s]} />
              <meshStandardMaterial color="#3b6fff" transparent opacity={0.2} depthWrite={false} />
            </mesh>
            {/* Wireframe outline */}
            <mesh>
              <boxGeometry args={[s, s, s]} />
              <meshStandardMaterial color="#3b82f6" wireframe />
            </mesh>
            {/* + button: add a cube on top (only on topmost cube of a stack) */}
            {active && isTop && (
              <Html position={[0, s / 2 + 0.04, 0]} center zIndexRange={[200, 0]}>
                <button
                  className="build-btn build-add"
                  onPointerDown={(e) => { e.stopPropagation(); onAddCube(cube.x, cube.z, cube.layer + 1) }}
                >+</button>
              </Html>
            )}
            {/* − button: remove this cube (top-right corner) */}
            {active && (
              <Html position={[s * 0.52, s * 0.52, -s * 0.52]} center zIndexRange={[200, 0]}>
                <button
                  className="build-btn build-del"
                  onPointerDown={(e) => { e.stopPropagation(); onRemoveCube(cube.id) }}
                >−</button>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
