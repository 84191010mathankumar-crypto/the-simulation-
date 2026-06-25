/**
 * Instanced flat-panel pile inside a panel storage rectangle.
 * Panels lie flat: [panelSize × 1.5 m] footprint, 0.1 m thick, stacked 4 layers.
 * Uses the same position list as buildPanelSimulation so hiddenKeys line up exactly.
 */
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { panelAreaSources, sourceKey } from './simulation'

const PANEL_HEIGHT    = 1.5
const PANEL_THICKNESS = 0.1
const _dummy = new THREE.Object3D()

export default function PanelStorageVisual({ rect, panelSize = 2, hiddenKeys = null }) {
  const positions = useMemo(
    () => panelAreaSources({ ...rect, panelSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect.minX, rect.maxX, rect.minZ, rect.maxZ, panelSize],
  )

  const visible = useMemo(
    () => (hiddenKeys && hiddenKeys.size
      ? positions.filter((p) => !hiddenKeys.has(sourceKey(p)))
      : positions),
    [positions, hiddenKeys],
  )

  const meshRef = useRef()
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < positions.length; i++) {
      const p = i < visible.length ? visible[i] : null
      if (p) _dummy.position.set(p[0], p[1], p[2])
      else   _dummy.position.set(0, -1000, 0)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [visible, positions])

  if (positions.length === 0) return null

  // Panels lie flat: panelSize along X, 1.5 m along Z, 0.1 m tall (Y).
  const pw = panelSize * 0.94
  const pd = PANEL_HEIGHT * 0.94
  const ph = PANEL_THICKNESS * 0.88

  return (
    <instancedMesh ref={meshRef} args={[null, null, positions.length]} castShadow>
      <boxGeometry args={[pw, ph, pd]} />
      <meshStandardMaterial color="#0891b2" metalness={0.08} roughness={0.65} />
    </instancedMesh>
  )
}
