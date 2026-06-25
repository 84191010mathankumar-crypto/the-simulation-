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

/** Stable key for a world position, so storage cubes and the boxes that
 *  consume them (each box's `from` IS a source position) can be matched up. */
export function sourceKey(p) {
  return `${Math.round(p[0] * 1000)}:${Math.round(p[1] * 1000)}:${Math.round(p[2] * 1000)}`
}

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

/** Is point (x,z) inside the rectangle? */
function inArea(x, z, g) {
  return x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ
}


/**
 * Build the scheduler job from the current plan.
 *
 *   robotMode — 'arms' (every box built by the mobile arm fleet, the default)
 *               or 'gantry' (each box is routed to a gantry whose area covers
 *               BOTH its storage source and its build target; boxes no gantry
 *               can reach fall back to the arms).
 *
 * Returns:
 *   boxes     — one task per buildable cube (capped at storage capacity),
 *               each { id, size, from, to, grab, priority, robot } in scheduler
 *               shape.  `robot` is { type:'arm' } or { type:'gantry', gantryId }.
 *               Lower build layers get a lower `priority` number so they are
 *               placed before the layers that stack on top of them.
 *   needed    — total build cubes requested,
 *   available — total boxes the storage areas supply,
 *   missing   — max(0, needed − available),
 *   assignment — { mode, gantryBoxes, armBoxes, gantriesWithoutStorage }
 *               summary used by the panel to explain gantry routing.
 */
export function buildSimulation({ buildCubes, storageAreas, unit, gantries = [], robotMode = 'arms' }) {
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
  const used = new Array(sources.length).fill(false)

  // ── Source pools ────────────────────────────────────────────────────────
  // In gantry mode each gantry reserves the storage boxes that fall inside its
  // own area; arms draw from the leftover (un-reserved) boxes first, then from
  // any reserved box still going spare.
  const gantryMode = robotMode === 'gantry' && gantries.length > 0
  const gantrySources = new Map()     // gantryId -> [source indices] (consumed)
  const gantryStock = new Map()       // gantryId -> original # of storage boxes
  const gantryTargets = new Map()     // gantryId -> # build cubes in its area
  let fallbackOrder
  if (gantryMode) {
    for (const g of gantries) { gantrySources.set(g.id, []); gantryTargets.set(g.id, 0) }
    const free = []
    sources.forEach((p, i) => {
      const owner = gantries.find((g) => inArea(p[0], p[2], g))
      if (owner) gantrySources.get(owner.id).push(i)
      else free.push(i)
    })
    const reserved = []
    for (const g of gantries) {
      gantryStock.set(g.id, gantrySources.get(g.id).length)
      reserved.push(...gantrySources.get(g.id))
    }
    fallbackOrder = [...free, ...reserved]
  } else {
    fallbackOrder = sources.map((_, i) => i)
  }

  let fbCursor = 0
  const takeGlobal = () => {
    while (fbCursor < fallbackOrder.length && used[fallbackOrder[fbCursor]]) fbCursor++
    if (fbCursor >= fallbackOrder.length) return -1
    const i = fallbackOrder[fbCursor++]
    used[i] = true
    return i
  }
  const takeFromGantry = (id) => {
    const list = gantrySources.get(id)
    while (list && list.length) {
      const i = list.shift()
      if (!used[i]) { used[i] = true; return i }
    }
    return -1
  }

  const boxes = []
  let gantryBoxes = 0
  let armBoxes = 0
  for (let t = 0; t < targets.length && boxes.length < count; t++) {
    const cube = targets[t]
    const to = [cube.x, cube.layer * unit + unit / 2, cube.z]

    let srcIdx = -1
    let robot = { type: 'arm' }

    if (gantryMode) {
      // Tally targets per containing gantry (for the "no storage" message) and
      // pick the first gantry that both covers this target and still has a
      // storage box left inside its own area.
      let chosen = null
      for (const g of gantries) {
        if (!inArea(cube.x, cube.z, g)) continue
        gantryTargets.set(g.id, gantryTargets.get(g.id) + 1)
        if (!chosen && gantrySources.get(g.id).some((i) => !used[i])) chosen = g
      }
      if (chosen) {
        srcIdx = takeFromGantry(chosen.id)
        if (srcIdx >= 0) robot = { type: 'gantry', gantryId: chosen.id }
      }
    }

    if (srcIdx < 0) { srcIdx = takeGlobal(); robot = { type: 'arm' } }
    if (srcIdx < 0) break   // storage exhausted

    boxes.push({
      id: `simbox-${cube.id}`,
      size: [s, s, s],
      from: sources[srcIdx],
      to,
      fromRotation: [0, 0, 0],
      toRotation: [0, 0, 0],
      grab: [0, 1, 0],
      priority: cube.layer,
      robot,
    })
    if (robot.type === 'gantry') gantryBoxes++
    else armBoxes++
  }

  // A gantry that has build targets in its area but no storage boxes of its
  // own can't pick-and-place anything — those boxes fall back to the arms.
  const gantriesWithoutStorage = gantryMode
    ? gantries.filter((g) => gantryTargets.get(g.id) > 0 && gantryStock.get(g.id) === 0).map((g) => g.id)
    : []

  return {
    boxes,
    needed,
    available,
    missing,
    assignment: { mode: robotMode, gantryBoxes, armBoxes, gantriesWithoutStorage },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel simulation helpers
// ─────────────────────────────────────────────────────────────────────────────
const PANEL_HEIGHT   = 1.5   // wall height in metres
const PANEL_THICKNESS = 0.1  // wall / panel thickness
const PANEL_STACK_LAYERS = 4 // how many panels high each storage pile goes

/**
 * Returns all panel positions (lying flat) inside one panel storage area.
 * Panels lie flat: [panelSize × PANEL_HEIGHT (1.5m)] footprint, PANEL_THICKNESS tall.
 * Exported so PanelStorageVisual can use the exact same layout.
 */
export function panelAreaSources(area) {
  const { panelSize = 2, layers = PANEL_STACK_LAYERS } = area
  const w = area.maxX - area.minX
  const d = area.maxZ - area.minZ
  const cols = Math.max(1, Math.floor(w / panelSize))
  // Panels stand vertically; each slot is PANEL_THICKNESS deep (with a small gap).
  const slotD = PANEL_THICKNESS * 1.5
  const rows  = Math.max(1, Math.min(layers, Math.floor(d / slotD)))
  const stepX = w / cols
  const stepZ = d / rows
  const out = []
  // Front row first so the pile depletes from the front.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push([
        area.minX + (c + 0.5) * stepX,
        PANEL_HEIGHT / 2,                 // standing upright — centre at half height
        area.minZ + (r + 0.5) * stepZ,
      ])
    }
  }
  return out
}

/** Decompose one drawn panel run into individual segment centre positions. */
function panelRunSegments(run) {
  const { x1, z1, x2, z2, size = 2 } = run
  const axis = run.axis || (Math.abs(x2 - x1) >= Math.abs(z2 - z1) ? 'x' : 'z')
  if (axis === 'x') {
    const count = Math.max(1, Math.round(Math.abs(x2 - x1) / size))
    const dir   = x2 >= x1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1 + dir * (i + 0.5) * size, cz: z1, axis: 'x', size,
    }))
  } else {
    const count = Math.max(1, Math.round(Math.abs(z2 - z1) / size))
    const dir   = z2 >= z1 ? 1 : -1
    return Array.from({ length: count }, (_, i) => ({
      cx: x1, cz: z1 + dir * (i + 0.5) * size, axis: 'z', size,
    }))
  }
}

/**
 * Build pick-and-place tasks for the panel system.
 *
 * `panels`           — drawn wall runs (targets).
 * `panelStorageAreas`— rectangles filled with lying-flat panels (sources).
 * `gantries`         — gantry areas; panel targets inside a gantry area are
 *                      assigned to that gantry instead of the arm fleet.
 *
 * Returns panelBoxes (scheduler tasks), needed, available, missing.
 */
export function buildPanelSimulation({ panels, panelStorageAreas, gantries = [] }) {
  // Decompose every panel run into individual segments.
  const targets = []
  for (const run of panels) {
    const segs = panelRunSegments(run)
    for (let i = 0; i < segs.length; i++) {
      targets.push({ ...segs[i], runId: run.id, segIdx: i, id: `${run.id}-${i}` })
    }
  }

  // Collect all source positions from storage areas.
  const sources = []
  for (const area of panelStorageAreas) {
    const slots = panelAreaSources(area)
    for (const pos of slots) sources.push({ pos, panelSize: area.panelSize || 2 })
  }

  const needed    = targets.length
  const available = sources.length
  const used      = new Array(sources.length).fill(false)
  const panelBoxes = []

  for (const tgt of targets) {
    // Nearest unused source whose panelSize matches the target size.
    let bestIdx = -1, bestDist = Infinity
    for (let i = 0; i < sources.length; i++) {
      if (used[i] || sources[i].panelSize !== tgt.size) continue
      const dx = sources[i].pos[0] - tgt.cx
      const dz = sources[i].pos[2] - tgt.cz
      const d2 = dx * dx + dz * dz
      if (d2 < bestDist) { bestDist = d2; bestIdx = i }
    }
    if (bestIdx < 0) break
    used[bestIdx] = true

    const { pos } = sources[bestIdx]
    const w = tgt.axis === 'x' ? tgt.size : PANEL_THICKNESS
    const d = tgt.axis === 'z' ? tgt.size : PANEL_THICKNESS

    // Assign to a gantry if the target position falls inside its area.
    let robot = { type: 'arm' }
    for (const g of gantries) {
      if (inArea(tgt.cx, tgt.cz, g)) { robot = { type: 'gantry', gantryId: g.id }; break }
    }

    panelBoxes.push({
      id: `simpanel-${tgt.id}`,
      size: [w, PANEL_HEIGHT, d],
      from: pos,
      to:   [tgt.cx, PANEL_HEIGHT / 2, tgt.cz],
      fromRotation: [0, 0, 0],
      toRotation:   [0, 0, 0],
      grab:     [0, 1, 0],
      priority: 0,
      robot,
      panelData: { runId: tgt.runId, segIdx: tgt.segIdx, axis: tgt.axis, size: tgt.size },
    })
  }

  return {
    panelBoxes,
    needed,
    available,
    missing: Math.max(0, needed - panelBoxes.length),
  }
}
