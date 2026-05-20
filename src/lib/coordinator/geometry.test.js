import { describe, it, expect } from 'vitest'
import { dist2D, pointSegmentDistance, segmentSegmentDistance } from './geometry.js'

describe('dist2D', () => {
  it('returns 0 for identical points', () => {
    expect(dist2D([1, 2], [1, 2])).toBe(0)
  })
  it('matches Pythagoras', () => {
    expect(dist2D([0, 0], [3, 4])).toBeCloseTo(5, 9)
  })
})

describe('pointSegmentDistance', () => {
  it('returns endpoint distance when the projection falls before the segment', () => {
    expect(pointSegmentDistance([-2, 0], [0, 0], [5, 0])).toBeCloseTo(2, 9)
  })
  it('returns endpoint distance when the projection falls past the segment', () => {
    expect(pointSegmentDistance([10, 0], [0, 0], [5, 0])).toBeCloseTo(5, 9)
  })
  it('returns perpendicular distance when the projection is inside the segment', () => {
    expect(pointSegmentDistance([2, 3], [0, 0], [5, 0])).toBeCloseTo(3, 9)
  })
  it('handles a zero-length segment as point-to-point', () => {
    expect(pointSegmentDistance([3, 4], [0, 0], [0, 0])).toBeCloseTo(5, 9)
  })
})

describe('segmentSegmentDistance', () => {
  it('returns 0 for crossing segments', () => {
    const d = segmentSegmentDistance([-1, 0], [1, 0], [0, -1], [0, 1])
    expect(d).toBeCloseTo(0, 9)
  })

  it('returns the perpendicular gap for parallel non-overlapping segments', () => {
    const d = segmentSegmentDistance([0, 0], [5, 0], [0, 2], [5, 2])
    expect(d).toBeCloseTo(2, 9)
  })

  it('returns endpoint distance for collinear, separated segments', () => {
    const d = segmentSegmentDistance([0, 0], [1, 0], [3, 0], [4, 0])
    expect(d).toBeCloseTo(2, 9)
  })

  it('is symmetric', () => {
    const A1 = [0, 0], A2 = [2, 1]
    const B1 = [5, 5], B2 = [6, 4]
    const d1 = segmentSegmentDistance(A1, A2, B1, B2)
    const d2 = segmentSegmentDistance(B1, B2, A1, A2)
    expect(d1).toBeCloseTo(d2, 9)
  })

  it('handles zero-length on one side (point-to-segment)', () => {
    const d = segmentSegmentDistance([2, 3], [2, 3], [0, 0], [5, 0])
    expect(d).toBeCloseTo(3, 9)
  })
})
