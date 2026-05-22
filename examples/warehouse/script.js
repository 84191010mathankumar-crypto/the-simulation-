/**
 * Warehouse scenario — build a small house from wall slabs.
 *
 * The pickup zone sits on the west side of the room (negative X); the robots
 * carry pieces east and assemble them into a 3 × 3 m house with a roof and
 * a chimney.  Edit the constants below to resize the house or change where
 * the pieces start; the layout below is self-contained.
 *
 * Each box entry has:
 *   id            — unique string
 *   size          — [w, h, d] in metres (box-local axes)
 *   from          — [x, y, z] world position of the box's centre at scene start
 *   to            — [x, y, z] world position where the robot should deposit it
 *   fromRotation  — [rx, ry, rz] world-frame Euler at pickup (so the boxes
 *                   look 'scattered' on the floor)
 *   toRotation    — [rx, ry, rz] world-frame Euler at the drop location
 *                   (usually all zeros so the size array directly defines the
 *                   final orientation)
 *   grab          — unit vector in the BOX'S LOCAL frame pointing OUT of the
 *                   face the gripper approaches.  [0, 1, 0] = grab from on top.
 *   priority      — small integer; the scheduler only picks pending tasks
 *                   with the lowest priority currently available.  Use this
 *                   to enforce a build order (walls before roof, roof before
 *                   chimney, …).
 *
 * The y component is normally the box's half-height so the bottom sits flat
 * on the floor (y = 0).
 */
export const ROOM_SIZE = 20
export const FLOOR_Y   = 0

const TOP = [0, 1, 0]

// ── House parameters ───────────────────────────────────────────────────────
const HOUSE_X   = 6        // centre of the house, world X
const HOUSE_Z   = 0        // centre of the house, world Z
const HOUSE_W   = 3.0      // outer width  (X extent)
const HOUSE_D   = 3.0      // outer depth  (Z extent)
const WALL_H    = 1.0      // wall height
const WALL_T    = 0.18     // wall thickness
const ROOF_T    = 0.12     // roof slab thickness
const ROOF_OVERHANG = 0.25 // roof extends this much past the walls on each side

// ── Pickup zone (west wall) ────────────────────────────────────────────────
const PICK_X = -7          // pickup column
const wallY  = WALL_H / 2  // wall centre Y while it's sitting on the floor

// Half extents so the wall slabs end up flush at the house corners.
const halfW = HOUSE_W / 2
const halfD = HOUSE_D / 2

const HALF_PI = Math.PI / 2

export const boxes = [
  // ── Four outer walls ─────────────────────────────────────────────────────
  // North + south walls: at pickup they're rotated 90° about Y so their long
  // edge runs along Z; the robot rotates them back to lie along X.
  { id: 'wall-N',
    size: [HOUSE_W, WALL_H, WALL_T],
    from: [PICK_X, wallY, -4],
    to:   [HOUSE_X, wallY, HOUSE_Z - halfD],
    fromRotation: [0,  HALF_PI, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 0 },

  { id: 'wall-S',
    size: [HOUSE_W, WALL_H, WALL_T],
    from: [PICK_X, wallY, -2],
    to:   [HOUSE_X, wallY, HOUSE_Z + halfD],
    fromRotation: [0, -HALF_PI, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 0 },

  // East + west walls: long along Z in their final pose; pre-rotated so they
  // sit long-along-X at pickup, will rotate 90° during transit.
  { id: 'wall-E',
    size: [WALL_T, WALL_H, HOUSE_D],
    from: [PICK_X, wallY, 0],
    to:   [HOUSE_X + halfW, wallY, HOUSE_Z],
    fromRotation: [0,  HALF_PI, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 0 },

  { id: 'wall-W',
    size: [WALL_T, WALL_H, HOUSE_D],
    from: [PICK_X, wallY, 2],
    to:   [HOUSE_X - halfW, wallY, HOUSE_Z],
    fromRotation: [0, -HALF_PI, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 0 },

  // ── Doorstep ─ flat slab; arrives slightly skewed, lands square. ─────────
  { id: 'step',
    size: [0.8, 0.15, 0.3],
    from: [PICK_X - 1, 0.075, 5],
    to:   [HOUSE_X, 0.075, HOUSE_Z + halfD + 0.15],
    fromRotation: [0,  0.35, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 0 },

  // ── Roof (placed on top of the walls, slight overhang) ───────────────────
  // Pre-rotated 90° so the long edge lies along Z at pickup.
  { id: 'roof',
    size: [HOUSE_W + 2 * ROOF_OVERHANG, ROOF_T, HOUSE_D + 2 * ROOF_OVERHANG],
    from: [PICK_X - 1, ROOF_T / 2, 4],
    to:   [HOUSE_X, WALL_H + ROOF_T / 2, HOUSE_Z],
    fromRotation: [0, HALF_PI, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 1 },

  // ── Chimney (sits on the roof) ───────────────────────────────────────────
  // Tilted at pickup; the robot straightens it out as it carries it up.
  { id: 'chimney',
    size: [0.3, 0.45, 0.3],
    from: [PICK_X - 1, 0.225, -5],
    to:   [HOUSE_X + 0.8, WALL_H + ROOF_T + 0.225, HOUSE_Z - 0.8],
    fromRotation: [0, Math.PI / 4, 0],
    toRotation:   [0, 0, 0],
    grab: TOP,
    priority: 2 },
]
