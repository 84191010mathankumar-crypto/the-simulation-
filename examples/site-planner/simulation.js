/**
 * Pure (React-free) helpers that turn the site plan into a pick-and-place job
 * for the warehouse scheduler:
 *
 *   - storage areas  → a pool of unit boxes the arms can fetch (the SOURCES),
 *   - build cubes     → where each box must end up (the TARGETS),
 *
 * and report how many boxes are missing when the build needs more than the
 * storage areas can supply.
 *
 * Box source/target positions are kept consistent with the visuals:
 *   - sources match <StorageVisual>'s stacked cubes,
 *   - targets match <BuildResultTool>'s cubes (cell centre, layer height).
 */

// Must match STACK_LAYERS in RobotVisuals.jsx so the box count we promise
// equals the number of cubes the storage piles actually show.
const STACK_LAYERS = 3

/** Number of unit boxes a single storage rectangle holds (cols × rows × layers). */
function capacityOfArea(area, unit) {
  const w = area.maxX - area.minX
  const d = area.maxZ - area.minZ
  const cols = Math.min(14, Math.max(1, Math.floor(w / unit)))
  const rows = Math.min(14, Math.max(1, Math.floor(d / unit)))
  return cols * rows * STACK_LAYERS
}

/** Total boxes available across every storage area. */
export function storageCapacity(storageAreas, unit) {
  let n = 0
  for (const area of storageAreas) n += capacityOfArea(area, unit)
  return n
}

/* Every box position inside one storage area, top layer first so the pile
 * visually depletes from the top down as boxes are fetched. */
function areaSources(area, unit, out) {
  const w = area.maxX - area.minX
  const d = area.maxZ - area.minZ
  const cols = Math.min(14, Math.max(1, Math.floor(w / unit)))
  const rows = Math.min(14, Math.max(1, Math.floor(d / unit)))
  const stepX = w / cols
  const stepZ = d / rows
  for (let h = STACK_LAYERS - 1; h >= 0; h--) {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        out.push([
          area.minX + (c + 0.5) * stepX,
          (h + 0.5) * unit + 0.02,
          area.minZ + (r + 0.5) * stepZ,
        ])
      }
    }
  }
}

/* Flattened list of every available box position across all storage areas. */
function allSources(storageAreas, unit) {
  const out = []
  for (const area of storageAreas) areaSources(area, unit, out)
  return out
}

/**
 * Build the scheduler job from the current plan.
 *
 * Returns:
 *   boxes     — one task per buildable cube (capped at storage capacity),
 *               each { id, size, from, to, grab, priority } in scheduler shape.
 *               Lower build layers get a lower `priority` number so they are
 *               placed before the layers that stack on top of them.
 *   needed    — total build cubes requested,
 *   available — total boxes the storage areas supply,
 *   missing   — max(0, needed − available).
 */
export function buildSimulation({ buildCubes, storageAreas, unit }) {
  const needed = buildCubes.length
  const available = storageCapacity(storageAreas, unit)
  const missing = Math.max(0, needed - available)

  // Place lower layers first (physically required for stacking) and, within a
  // layer, nearest the origin-ish ordering is irrelevant — the scheduler picks
  // the nearest pending box per robot at run time.
  const targets = [...buildCubes].sort((a, b) => a.layer - b.layer)
  const sources = allSources(storageAreas, unit)

  const s = unit * 0.9
  const count = Math.min(needed, available)
  const boxes = []
  for (let i = 0; i < count; i++) {
    const cube = targets[i]
    boxes.push({
      id: `simbox-${cube.id}`,
      size: [s, s, s],
      from: sources[i],
      to: [cube.x, cube.layer * unit + unit / 2, cube.z],
      fromRotation: [0, 0, 0],
      toRotation: [0, 0, 0],
      grab: [0, 1, 0],
      priority: cube.layer,
    })
  }

  return { boxes, needed, available, missing }
}
