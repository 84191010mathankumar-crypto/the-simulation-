/**
 * Warehouse scenario — pseudo-script.
 *
 * Edit this file to define what gets moved where.  Each box has:
 *
 *   id         — any unique string
 *   size       — [width, height, depth] in metres
 *   from       — [x, y, z] world position of the box's centre at scene start
 *   to         — [x, y, z] world position where the robot should deposit it
 *   grab       — [gx, gy, gz] unit vector in the BOX'S LOCAL frame pointing
 *                OUT of the face the gripper approaches.  Defaults to [0, 1, 0]
 *                (grab from on top) if omitted.
 *
 * The y component is normally the box's half-height — that way the bottom of
 * the box sits flat on the floor (y=0).
 *
 * The room itself is fixed at ROOM_SIZE × ROOM_SIZE metres, floor at y=0.
 */
export const ROOM_SIZE = 20   // metres, the room is a ROOM_SIZE × ROOM_SIZE square centred at origin
export const FLOOR_Y   = 0

// Default approach direction — grab from on top.
const TOP = [0, 1, 0]

// Helper so the box sits flat on the floor by default.
const h = (size) => size[1] / 2

export const boxes = [
  // Three "pickup zone" boxes at x = -7 → "drop zone" at x = +7
  { id: 'A', size: [0.3, 0.3, 0.3], from: [-7,  h([0.3,0.3,0.3]), -3], to: [ 7,  h([0.3,0.3,0.3]), -3], grab: TOP },
  { id: 'B', size: [0.25, 0.4, 0.25], from: [-7,  h([0.25,0.4,0.25]),  0], to: [ 7,  h([0.25,0.4,0.25]),  0], grab: TOP },
  { id: 'C', size: [0.35, 0.2, 0.35], from: [-7,  h([0.35,0.2,0.35]),  3], to: [ 7,  h([0.35,0.2,0.35]),  3], grab: TOP },

  // Cross-pattern: pick from the four mid-room corners, place near centre
  { id: 'NW', size: [0.3, 0.3, 0.3], from: [-4,  h([0.3,0.3,0.3]),  6], to: [ 0,  h([0.3,0.3,0.3]), -6], grab: TOP },
  { id: 'NE', size: [0.3, 0.3, 0.3], from: [ 4,  h([0.3,0.3,0.3]),  6], to: [ 0,  h([0.3,0.3,0.3]),  6], grab: TOP },
  { id: 'SW', size: [0.3, 0.3, 0.3], from: [-4,  h([0.3,0.3,0.3]), -6], to: [-6,  h([0.3,0.3,0.3]),  0], grab: TOP },
  { id: 'SE', size: [0.3, 0.3, 0.3], from: [ 4,  h([0.3,0.3,0.3]), -6], to: [ 6,  h([0.3,0.3,0.3]),  0], grab: TOP },
]
