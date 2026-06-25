/**
 * Instanced panel storage visual — panels stand upright (vertical).
 * Each panel: panelSize wide (X), 1.5 m tall (Y), 0.1 m deep (Z).
 * A "+" HTML button lets the user add more rows to that storage area.
 */
import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { panelAreaSources, sourceKey } from './simulation'

const PANEL_HEIGHT    = 1.5
const PANEL_THICKNESS = 0.1
const _dummy = new THREE.Object3D()

export default function PanelStorageVisual({ rect, panelSize = 2, hiddenKeys = null, onUpdate, selected = false }) {
  const positions = useMemo(
    () => panelAreaSources({ ...rect, panelSize }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rect.minX, rect.maxX, rect.minZ, rect.maxZ, panelSize, rect.layers],
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

  // Panels stand upright: panelSize along X, 1.5 m tall (Y), 0.1 m deep (Z).
  const pw = panelSize * 0.94
  const ph = PANEL_HEIGHT * 0.92
  const pd = PANEL_THICKNESS * 0.75

  // Centre of the storage area for the "+" button
  const cx = (rect.minX + rect.maxX) / 2
  const cz = (rect.minZ + rect.maxZ) / 2
  const layers = rect.layers ?? 4

  return (
    <group>
      <instancedMesh ref={meshRef} args={[null, null, positions.length]} castShadow frustumCulled={false}>
        <boxGeometry args={[pw, ph, pd]} />
        <meshStandardMaterial color="#0891b2" metalness={0.08} roughness={0.65} />
      </instancedMesh>

      {/* "+" button — only when this storage area is selected and not simulating */}
      {onUpdate && selected && (
        <Html center position={[cx, PANEL_HEIGHT + 0.5, cz]} zIndexRange={[100, 0]}
          style={{ pointerEvents: 'all' }}>
          <button
            title={`Add row (${layers} rows now)`}
            onPointerDown={(e) => {
              e.stopPropagation()
              const sx = e.clientX, sy = e.clientY
              const up = (ev) => {
                window.removeEventListener('pointerup', up)
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5)
                  onUpdate({ layers: layers + 1 })
              }
              window.addEventListener('pointerup', up)
            }}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: '#0891b2', border: '2px solid #fff', color: '#fff',
              cursor: 'pointer', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)', padding: 0,
              lineHeight: 1,
            }}
          >+</button>
        </Html>
      )}
    </group>
  )
}
