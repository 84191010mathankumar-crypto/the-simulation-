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
      from: [PICK_X, wallY, -6], to: [HOUSE_X, wallY, HOUSE_Z - halfD],
      fromRotation: [0,  HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-S', size: [HOUSE_W, WALL_H, WALL_T],
      from: [PICK_X, wallY, -2], to: [HOUSE_X, wallY, HOUSE_Z + halfD],
      fromRotation: [0, -HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-E', size: [WALL_T, WALL_H, HOUSE_D],
      from: [PICK_X, wallY, 1], to: [HOUSE_X + halfW, wallY, HOUSE_Z],
      fromRotation: [0,  HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-wall-W', size: [WALL_T, WALL_H, HOUSE_D],
      from: [PICK_X, wallY, 2.5], to: [HOUSE_X - halfW, wallY, HOUSE_Z],
      fromRotation: [0, -HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-step', size: [0.8, 0.15, 0.3],
      from: [PICK_X - 1, 0.075, 4], to: [HOUSE_X, 0.075, HOUSE_Z + halfD + 0.15],
      fromRotation: [0, 0.35, 0], toRotation: [0, 0, 0], grab: TOP, priority: 0 },
    { id: 'h-roof', size: [HOUSE_W + 2 * ROOF_OVERHANG, ROOF_T, HOUSE_D + 2 * ROOF_OVERHANG],
      from: [PICK_X - 1, ROOF_T / 2, 7], to: [HOUSE_X, WALL_H + ROOF_T / 2, HOUSE_Z],
      fromRotation: [0, HALF_PI, 0], toRotation: [0, 0, 0], grab: TOP, priority: 1 },
    { id: 'h-chimney', size: [0.3, 0.45, 0.3],
      from: [PICK_X - 1, 0.225, -9], to: [HOUSE_X + 0.8, WALL_H + ROOF_T + 0.225, HOUSE_Z - 0.8],
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
// A 3-tier stepped pyramid built from 35 crates that arrive scattered in a
// pile on the west side of the room. Priorities enforce the build order:
//   base (5×5, p=0) → middle (3×3, p=1) → cap (1, p=2).
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
  // Scatter a pickup position around the west column without piling boxes on top
  // of each other.  We hand out positions on a coarse grid then jitter slightly.
  const scatterSlots = []
  for (let zi = -4; zi <= 4; zi++) {
    for (let xi = -1; xi <= 1; xi++) {
      scatterSlots.push([PICK_X + xi * 1.0, -6 + (zi + 4) * 1.5])
    }
  }
  // Fisher-Yates shuffle so slot assignment doesn't correlate with tier order.
  for (let k = scatterSlots.length - 1; k > 0; k--) {
    const j = Math.floor(rand() * (k + 1))
    ;[scatterSlots[k], scatterSlots[j]] = [scatterSlots[j], scatterSlots[k]]
  }
  let slotIdx = 0
  const nextPickup = () => {
    const [sx, sz] = scatterSlots[slotIdx++ % scatterSlots.length]
    return [sx + (rand() - 0.5) * 0.3, C / 2, sz + (rand() - 0.5) * 0.3]
  }

  const boxes = []
  const addTier = (n, y, priority, tag) => {
    const off = (n - 1) / 2
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        boxes.push({
          id: `z-${tag}-${i}${j}`,
          size: [C, C, C],
          from: nextPickup(),
          to:   [CENTRE_X + (i - off) * STEP, y, CENTRE_Z + (j - off) * STEP],
          fromRotation: [0, rand() * Math.PI - Math.PI / 2, 0],
          toRotation:   [0, 0, 0],
          grab: TOP,
          priority,
        })
      }
    }
  }

  addTier(5, C / 2,           0, 't0')   // base — 25 crates
  addTier(3, C / 2 + C,       1, 't1')   // middle — 9 crates
  addTier(1, C / 2 + 2 * C,   2, 'cap')  // capstone — 1 crate

  return {
    id: 'ziggurat',
    name: 'Ziggurat',
    description: `${boxes.length}-crate stepped pyramid · priorities`,
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

// ═══════════════════════════════════════════════════════════════════════════
// Custom-scenario DSL — shown in the live editor as initial text.
//
// One block per box.  A non-indented line is a box name; the indented lines
// below it are its fields (`key: value`).  Order of blocks = build order;
// use `tier: N` to make a box wait for lower-tier boxes to finish.
//
//   size: w, h, d                (meters)
//   from: x, y, z                (pickup position, meters)
//   to:   x, y, z                (target position, meters)
//   rot:  yaw                    (pickup orientation, degrees around Y;
//                                 or `rx, ry, rz` for full XYZ)
//   to-rot: yaw                  (target orientation, defaults to 0)
//   tier: N                      (build tier, defaults to 0)
//
// Grab face is always the top of the box.  Lines starting with `#` are comments.
// ═══════════════════════════════════════════════════════════════════════════
export const DEFAULT_CUSTOM_CODE = `# House build plan.
# Each block is one box. Fields are indented "key: value" lines.
# Order = build order. Use \`tier:\` to defer a box.

wall-N
  size: 3, 1, 0.18
  from: -7, 0.5, -6
  rot:  90
  to:   6, 0.5, -1.5

wall-S
  size: 3, 1, 0.18
  from: -7, 0.5, -2
  rot:  -90
  to:   6, 0.5, 1.5

wall-E
  size: 0.18, 1, 3
  from: -7, 0.5, 1
  rot:  90
  to:   7.5, 0.5, 0

wall-W
  size: 0.18, 1, 3
  from: -7, 0.5, 2.5
  rot:  -90
  to:   4.5, 0.5, 0

step
  size: 0.8, 0.15, 0.3
  from: -8, 0.075, 4
  rot:  20
  to:   6, 0.075, 1.65

roof
  size: 3.5, 0.12, 3.5
  from: -8, 0.06, 7
  rot:  90
  to:   6, 1.06, 0
  tier: 1

chimney
  size: 0.3, 0.45, 0.3
  from: -8, 0.225, -9
  rot:  45
  to:   6.8, 1.345, -0.8
  tier: 2
`

// ── DSL parser ────────────────────────────────────────────────────────────
const D2R = Math.PI / 180

function parseTuple(s, n) {
  const parts = s.split(',').map((x) => parseFloat(x.trim()))
  if (parts.length !== n) return null
  if (parts.some((v) => !isFinite(v))) return null
  return parts
}

function parseRot(s) {
  const parts = s.split(',').map((x) => parseFloat(x.trim()))
  if (parts.some((v) => !isFinite(v))) return null
  if (parts.length === 1) return [0, parts[0] * D2R, 0]
  if (parts.length === 3) return parts.map((v) => v * D2R)
  return null
}

const NAME_RE = /^[A-Za-z0-9_\-]+$/
const FIELD_RE = /^\s+([A-Za-z][A-Za-z\-]*)\s*:\s*(.+?)\s*$/

/**
 * Parses the editor's DSL text into a boxes array.
 * Returns { boxes, error }: on failure, boxes is null and error names the
 * offending block + line.
 */
export function parseCustomCode(text) {
  const boxes = []
  const seen = new Set()
  const lines = String(text).split('\n')
  let block = null

  const finalize = () => {
    if (!block) return null
    const f = block.fields
    for (const k of ['size', 'from', 'to']) {
      if (!(k in f)) return `Block "${block.name}" (line ${block.line}): missing required field "${k}"`
    }
    const size = parseTuple(f.size, 3)
    if (!size) return `"${block.name}".size — expected "w, h, d"`
    const from = parseTuple(f.from, 3)
    if (!from) return `"${block.name}".from — expected "x, y, z"`
    const to = parseTuple(f.to, 3)
    if (!to) return `"${block.name}".to — expected "x, y, z"`
    const rot = f.rot != null ? parseRot(f.rot) : [0, 0, 0]
    if (!rot) return `"${block.name}".rot — expected yaw degrees or "rx, ry, rz"`
    const toRotKey = f['to-rot'] != null ? f['to-rot'] : null
    const toRot = toRotKey != null ? parseRot(toRotKey) : [0, 0, 0]
    if (!toRot) return `"${block.name}".to-rot — expected yaw degrees or "rx, ry, rz"`
    let tier = 0
    if (f.tier != null) {
      tier = parseInt(f.tier, 10)
      if (!Number.isFinite(tier)) return `"${block.name}".tier — must be an integer`
    }
    if (seen.has(block.name)) return `Duplicate box name "${block.name}"`
    seen.add(block.name)
    boxes.push({
      id: block.name,
      size, from, to,
      fromRotation: rot,
      toRotation: toRot,
      grab: TOP,
      priority: tier,
    })
    block = null
    return null
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/#.*$/, '').replace(/\s+$/, '')
    if (!raw.trim()) continue

    if (/^\s/.test(raw)) {
      // Indented → a field on the current block.
      if (!block) return { boxes: null, error: `Line ${i + 1}: indented field "${raw.trim()}" with no preceding box name` }
      const m = raw.match(FIELD_RE)
      if (!m) return { boxes: null, error: `Line ${i + 1}: expected "key: value", got "${raw.trim()}"` }
      const key = m[1].toLowerCase()
      if (key in block.fields) return { boxes: null, error: `Line ${i + 1}: duplicate field "${key}" in box "${block.name}"` }
      block.fields[key] = m[2]
    } else {
      // Column 0 → finalize previous block (if any), start a new one.
      const err = finalize()
      if (err) return { boxes: null, error: err }
      const name = raw.trim()
      if (!NAME_RE.test(name)) return { boxes: null, error: `Line ${i + 1}: invalid box name "${name}" (use letters, digits, "_" or "-")` }
      block = { name, fields: {}, line: i + 1 }
    }
  }

  const err = finalize()
  if (err) return { boxes: null, error: err }

  return { boxes, error: null }
}
