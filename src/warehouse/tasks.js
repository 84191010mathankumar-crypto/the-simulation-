/**
 * Scripted warehouse tasks.
 *
 * Each task moves one box from `from` to `to`.  Edit this list freely — the
 * coordinator decides at runtime which robot picks up which box.
 *
 *   from / to:  world-space [x, z] pairs (the y stays on the floor).
 *   size:       [w, h, d] of the box, in metres.  Influences IK approach.
 *   color:      box colour and the target-zone outline colour.
 *   label:      shown on the side panel.
 *
 * The room is 20 × 20 metres centred on the world origin, so all positions
 * should stay roughly within ±9 to leave a 1 m margin from the walls.
 */

export const TASKS = [
  { id: 'box-1', label: 'Crate A', from: [-7,  -6], to: [ 7,  5], size: [0.22, 0.22, 0.22], color: '#c15f3c' },
  { id: 'box-2', label: 'Crate B', from: [-5,   3], to: [ 6, -4], size: [0.18, 0.18, 0.18], color: '#4a6ea3' },
  { id: 'box-3', label: 'Crate C', from: [ 4,  -7], to: [-6,  6], size: [0.25, 0.25, 0.25], color: '#f59e0b' },
  { id: 'box-4', label: 'Crate D', from: [-3,   7], to: [ 3, -3], size: [0.20, 0.20, 0.20], color: '#10b981' },
  { id: 'box-5', label: 'Crate E', from: [ 6,   1], to: [-7, -2], size: [0.22, 0.22, 0.22], color: '#8b5cf6' },
  { id: 'box-6', label: 'Crate F', from: [ 2,   5], to: [-4, -6], size: [0.24, 0.24, 0.24], color: '#ec4899' },
]

/**
 * Robot docks — home positions and starting orientations.  Up to 6 robots
 * supported by the slider, chosen by `count`.  Coordinates are [x, z] on
 * the floor.
 */
export const ROBOT_DOCKS = [
  { id: 'r1', position: [-8, -8], color: '#ff6000' },
  { id: 'r2', position: [ 8, -8], color: '#3b6fff' },
  { id: 'r3', position: [-8,  8], color: '#10b981' },
  { id: 'r4', position: [ 8,  8], color: '#f59e0b' },
  { id: 'r5', position: [ 0, -9], color: '#ec4899' },
  { id: 'r6', position: [ 0,  9], color: '#8b5cf6' },
]

export const ROOM_SIZE = 20
