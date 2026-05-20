/**
 * Path-conflict detection for multi-robot warehouse coordination.
 *
 * Each robot announces the line segment from its current xz position to its
 * next drive target.  When a new robot wants to drive, we ask whether its
 * planned segment passes within `safetyDistance` of any currently-reserved
 * segment.  If so, the new robot waits.
 *
 * This is a deliberately simple scheme — it ignores timing (an already-moving
 * robot may have *almost* finished its leg) — which is fine for the demo:
 * conflicts are released as soon as the moving robot reaches its target.
 *
 * For a more sophisticated planner (CBS, velocity obstacles, time-windowed
 * reservations) this file is the place to add it; the public surface stays
 * the same.
 */
import { segmentSegmentDistance } from './geometry.js'

/**
 * @param {[number,number]} pStart  Planned-path start (xz)
 * @param {[number,number]} pEnd    Planned-path end (xz)
 * @param {Array<{from:[number,number], to:[number,number]}>} reservations
 *        Active segment reservations to check against.
 * @param {number} safetyDistance   Minimum clearance, metres.
 * @returns {boolean}  true if the planned path conflicts with any reservation
 */
export function pathConflicts(pStart, pEnd, reservations, safetyDistance) {
  if (!reservations || reservations.length === 0) return false
  for (const r of reservations) {
    const d = segmentSegmentDistance(pStart, pEnd, r.from, r.to)
    if (d < safetyDistance) return true
  }
  return false
}

/**
 * Check the static-robot version: would a planned path pass within
 * `safetyDistance` of any robot's current resting position?  Used so a moving
 * robot doesn't drive through one that's parked.
 */
export function pathClearOfRobots(pStart, pEnd, parkedPositions, safetyDistance) {
  if (!parkedPositions || parkedPositions.length === 0) return true
  // Reuse segment-segment by treating each parked robot as a zero-length segment
  for (const pos of parkedPositions) {
    const d = segmentSegmentDistance(pStart, pEnd, pos, pos)
    if (d < safetyDistance) return false
  }
  return true
}
