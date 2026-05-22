/**
 * Warehouse scenarios.
 *
 * Each scenario describes a pickup-and-place job for the robots. Edit existing
 * ones or add a new entry to `SCENARIOS` — the UI picks them up automatically.
 *
 * Box entry fields (see also examples/warehouse/scheduler.js):
 *   id, size, from, to, fromRotation, toRotation, grab, priority
 *
 * The y component of `from` / `to` is normally the box's half-height so the
 * bottom sits flat on the floor (y = 0).
 */
export const ROOM_SIZE = 20
export const FLOOR_Y   = 0

const TOP = [0, 1, 0]
const HALF_PI = Math.PI / 2

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 1 — House
// ═══════════════════════════════════════════════════════════════════════════
function buildHouseScenario() {
  const HOUSE_X = 6, HOUSE_Z = 0
  const HOUSE_W = 3.0, HOUSE_D = 3.0
  const WALL_H = 1.0, WALL_T = 0.18
  const ROOF_T = 0.12, ROOF_OVERHANG = 0.25
  const PICK_X = -7
  const wallY = WALL_H / 2
  const halfW = HOUSE_W / 2, halfD = HOUSE_D / 2

  const boxes = [
    { id: 'h-wall-N', size: [HOUSE_W, WALL_H, WALL_T],
      from: [PICK_X, wallY, -4], to: [HOUSE_X, wallY, HOUSE_Z - halfD],
      fromRotation: [0,  HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-S', size: [HOUSE_W, WALL_H, WALL_T],
      from: [PICK_X, wallY, -2], to: [HOUSE_X, wallY, HOUSE_Z + halfD],
      fromRotation: [0, -HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-E', size: [WALL_T, WALL_H, HOUSE_D],
      from: [PICK_X, wallY, 0], to: [HOUSE_X + halfW, wallY, HOUSE_Z],
      fromRotation: [0,  HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-W', size: [WALL_T, WALL_H, HOUSE_D],
      from: [PICK_X, wallY, 2], to: [HOUSE_X - halfW, wallY, HOUSE_Z],
      fromRotation: [0, -HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-step', size: [0.8, 0.15, 0.3],
      from: [PICK_X - 1, 0.075, 5], to: [HOUSE_X, 0.075, HOUSE_Z + halfD + 0.15],
      fromRotation: [0, 0.35, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-roof', size: [HOUSE_W + 2 * ROOF_OVERHANG, ROOF_T, HOUSE_D + 2 * ROOF_OVERHANG],
      from: [PICK_X - 1, ROOF_T / 2, 4], to: [HOUSE_X, WALL_H + ROOF_T / 2, HOUSE_Z],
      fromRotation: [0, HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 1 },
    { id: 'h-chimney', size: [0.3, 0.45, 0.3],
      from: [PICK_X - 1, 0.225, -5], to: [HOUSE_X + 0.8, WALL_H + ROOF_T + 0.225, HOUSE_Z - 0.8],
      fromRotation: [0, Math.PI / 4, 0], toRotation: [0, 0, 0], grab: TOP, priority: 2 },
  ]

  return {
    id: 'house',
    name: 'House',
    description: 'Assemble walls, roof and chimney',
    roomSize: ROOM_SIZE,
    boxes,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Scenario 2 — Ziggurat
//
// A 3-tier stepped pyramid built from 14 crates that arrive scattered in a
// pile on the west side of the room. Priorities enforce the build order:
//   base (3×3, p=0) → mid (2×2, p=1) → cap (1, p=2).
// ═══════════════════════════════════════════════════════════════════════════
function buildZigguratScenario() {
  const CENTRE_X = 6, CENTRE_Z = 0
  const PICK_X   = -7
  const C        = 0.5            // crate edge length (cube)
  const GAP      = 0.04           // gap between crates
  const STEP     = C + GAP

  // Deterministic pseudo-random for scattered pickup positions.
  let seed = 1
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }

  const boxes = []

  // ── Tier 0 — 3×3 base at y = C/2 ─────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const tx = CENTRE_X + (i - 1) * STEP
      const tz = CENTRE_Z + (j - 1) * STEP
      const px = PICK_X + (rand() - 0.5) * 2.4
      const pz = -5 + rand() * 10
      boxes.push({
        id: `z-t0-${i}${j}`,
        size: [C, C, C],
        from: [px, C / 2, pz],
        to:   [tx, C / 2, tz],
        fromRotation: [0, rand() * Math.PI - Math.PI / 2, 0],
        toRotation:   [0, 0, 0],
        grab: TOP,
        priority: 0,
      })
    }
  }

  // ── Tier 1 — 2×2 middle at y = 1.5 * C ───────────────────────────────────
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const tx = CENTRE_X + (i - 0.5) * STEP
      const tz = CENTRE_Z + (j - 0.5) * STEP
      const px = PICK_X + (rand() - 0.5) * 2.4
      const pz = -5 + rand() * 10
      boxes.push({
        id: `z-t1-${i}${j}`,
        size: [C, C, C],
        from: [px, C / 2, pz],
        to:   [tx, 1.5 * C, tz],
        fromRotation: [0, rand() * Math.PI - Math.PI / 2, 0],
        toRotation:   [0, 0, 0],
        grab: TOP,
        priority: 1,
      })
    }
  }

  // ── Tier 2 — single cap crate at y = 2.5 * C ─────────────────────────────
  boxes.push({
    id: 'z-cap',
    size: [C, C, C],
    from: [PICK_X + (rand() - 0.5) * 2.4, C / 2, -5 + rand() * 10],
    to:   [CENTRE_X, 2.5 * C, CENTRE_Z],
    fromRotation: [0, rand() * Math.PI - Math.PI / 2, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 2,
  })

  return {
    id: 'ziggurat',
    name: 'Ziggurat',
    description: '14-crate stepped pyramid · priorities',
    roomSize: ROOM_SIZE,
    boxes,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════
export const SCENARIOS = [
  buildHouseScenario(),
  buildZigguratScenario(),
]

// Back-compat with old callers (and the README example).
export const boxes = SCENARIOS[0].boxes
