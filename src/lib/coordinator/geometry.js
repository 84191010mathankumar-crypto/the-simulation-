/**
 * 2D (floor-plane) geometry helpers used by the warehouse coordinator.
 *
 * Robots live in 3D, but for assignment and collision-avoidance we only care
 * about their xz position — the y axis is just "off the ground".  Points
 * everywhere in this module are `[x, z]` pairs.
 */

export function dist2D(a, b) {
  const dx = a[0] - b[0]
  const dz = a[1] - b[1]
  return Math.hypot(dx, dz)
}

/** Closest distance from a point P to the closed segment AB, in 2D. */
export function pointSegmentDistance(p, a, b) {
  const ax = a[0], az = a[1]
  const bx = b[0], bz = b[1]
  const dx = bx - ax
  const dz = bz - az
  const len2 = dx * dx + dz * dz
  if (len2 < 1e-12) return dist2D(p, a)
  let t = ((p[0] - ax) * dx + (p[1] - az) * dz) / len2
  t = Math.max(0, Math.min(1, t))
  const px = ax + t * dx
  const pz = az + t * dz
  return Math.hypot(p[0] - px, p[1] - pz)
}

/**
 * Closest distance between two closed line segments in 2D.
 *
 * Implementation: sample the parametric min of the squared-distance function
 * over the unit square [s,t] ∈ [0,1]^2.  For non-parallel segments we solve
 * the 2×2 linear system; for parallel segments we fall back to checking
 * endpoint-to-segment distances.  Both cases clamp to the segment ends.
 *
 * Returns the distance (not squared).
 */
export function segmentSegmentDistance(a1, a2, b1, b2) {
  const ux = a2[0] - a1[0], uz = a2[1] - a1[1]
  const vx = b2[0] - b1[0], vz = b2[1] - b1[1]
  const wx = a1[0] - b1[0], wz = a1[1] - b1[1]

  const a = ux * ux + uz * uz
  const b = ux * vx + uz * vz
  const c = vx * vx + vz * vz
  const d = ux * wx + uz * wz
  const e = vx * wx + vz * wz
  const denom = a * c - b * b

  let s, t
  if (denom < 1e-12) {
    // Parallel or degenerate — pick a sensible s, derive t.
    s = 0
    t = (b > c ? d / b : e / c) || 0
  } else {
    s = (b * e - c * d) / denom
    t = (a * e - b * d) / denom
  }
  s = Math.max(0, Math.min(1, s))
  t = Math.max(0, Math.min(1, t))

  // Re-clamp using the clamped opposite param (handles corner cases).
  const sClamped = Math.max(0, Math.min(1, (b * t - d) / (a || 1e-12)))
  const tClamped = Math.max(0, Math.min(1, (b * s + e) / (c || 1e-12)))
  s = sClamped
  t = tClamped

  const px = a1[0] + s * ux
  const pz = a1[1] + s * uz
  const qx = b1[0] + t * vx
  const qz = b1[1] + t * vz
  return Math.hypot(px - qx, pz - qz)
}
