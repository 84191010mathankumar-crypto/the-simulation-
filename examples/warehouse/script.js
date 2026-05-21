/**
 * Warehouse scenario — build a small house from wall slabs.
 *
 * The pickup zone sits on the west side of the room (negative X); the robots
 * carry pieces east and assemble them into a 3 × 3 m house with a roof and
 * a chimney.  Edit the constants below to resize the house or change where
 * the pieces start; the layout below is self-contained.
 *
 * Each box entry has:
 *   id   — unique string
 *   size — [w, h, d] in metres
 *   from — [x, y, z] world position of the box's centre at scene start
 *   to   — [x, y, z] world position where the robot should deposit it
 *   grab — unit vector in the BOX'S LOCAL frame pointing OUT of the face
 *          the gripper approaches.  [0, 1, 0] = grab from on top.
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

export const boxes = [
  // ── Four outer walls ─────────────────────────────────────────────────────
  // Walls running along X (north + south faces of the house)
  { id: 'wall-N',
    size: [HOUSE_W, WALL_H, WALL_T],
    from: [PICK_X, wallY, -4],
    to:   [HOUSE_X, wallY, HOUSE_Z - halfD],
    grab: TOP },

  { id: 'wall-S',
    size: [HOUSE_W, WALL_H, WALL_T],
    from: [PICK_X, wallY, -2],
    to:   [HOUSE_X, wallY, HOUSE_Z + halfD],
    grab: TOP },

  // Walls running along Z (east + west faces) — same boxes rotated by swapping
  // X and Z extents.  The scheduler doesn't change box orientation, so the
  // size array IS what defines the final orientation.
  { id: 'wall-E',
    size: [WALL_T, WALL_H, HOUSE_D],
    from: [PICK_X, wallY, 0],
    to:   [HOUSE_X + halfW, wallY, HOUSE_Z],
    grab: TOP },

  { id: 'wall-W',
    size: [WALL_T, WALL_H, HOUSE_D],
    from: [PICK_X, wallY, 2],
    to:   [HOUSE_X - halfW, wallY, HOUSE_Z],
    grab: TOP },

  // ── Roof (placed on top of the walls, slight overhang) ───────────────────
  { id: 'roof',
    size: [HOUSE_W + 2 * ROOF_OVERHANG, ROOF_T, HOUSE_D + 2 * ROOF_OVERHANG],
    from: [PICK_X - 1, ROOF_T / 2, 4],
    to:   [HOUSE_X, WALL_H + ROOF_T / 2, HOUSE_Z],
    grab: TOP },

  // ── Chimney (sits on the roof) ───────────────────────────────────────────
  { id: 'chimney',
    size: [0.3, 0.45, 0.3],
    from: [PICK_X - 1, 0.225, -5],
    to:   [HOUSE_X + 0.8, WALL_H + ROOF_T + 0.225, HOUSE_Z - 0.8],
    grab: TOP },

  // ── Doorstep ─────────────────────────────────────────────────────────────
  { id: 'step',
    size: [0.8, 0.15, 0.3],
    from: [PICK_X - 1, 0.075, 5],
    to:   [HOUSE_X, 0.075, HOUSE_Z + halfD + 0.15],
    grab: TOP },
]
