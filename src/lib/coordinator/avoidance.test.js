import { describe, it, expect } from 'vitest'
import { pathConflicts, pathClearOfRobots } from './avoidance.js'

describe('pathConflicts', () => {
  it('returns false with no reservations', () => {
    expect(pathConflicts([0, 0], [5, 0], [], 1.0)).toBe(false)
  })

  it('returns true when paths cross', () => {
    const reservations = [{ from: [0, -5], to: [0, 5] }]
    expect(pathConflicts([-5, 0], [5, 0], reservations, 1.0)).toBe(true)
  })

  it('returns false when paths are parallel and well separated', () => {
    const reservations = [{ from: [0, 0], to: [10, 0] }]
    expect(pathConflicts([0, 5], [10, 5], reservations, 1.0)).toBe(false)
  })

  it('returns true for parallel paths within the safety margin', () => {
    const reservations = [{ from: [0, 0], to: [10, 0] }]
    expect(pathConflicts([0, 0.5], [10, 0.5], reservations, 1.0)).toBe(true)
  })

  it('returns true when planned path nearly grazes a reservation endpoint', () => {
    const reservations = [{ from: [5, 0], to: [10, 0] }]
    // Planned path's start is 0.4 m from (5,0) — under the 1.0 safety margin.
    expect(pathConflicts([5.4, 0], [-5, 5], reservations, 1.0)).toBe(true)
  })

  it('returns true if any of several reservations conflicts', () => {
    const reservations = [
      { from: [-10, -10], to: [-9, -9] },     // far away
      { from: [  0,  -5], to: [ 0,  5] },     // crosses planned path
    ]
    expect(pathConflicts([-5, 0], [5, 0], reservations, 1.0)).toBe(true)
  })

  it('a zero safety margin allows paths to touch without conflict', () => {
    const reservations = [{ from: [0, 0], to: [10, 0] }]
    expect(pathConflicts([0, 0.001], [10, 0.001], reservations, 0)).toBe(false)
  })
})

describe('pathClearOfRobots', () => {
  it('returns true with no parked robots', () => {
    expect(pathClearOfRobots([0, 0], [5, 0], [], 1.0)).toBe(true)
  })

  it('returns false if a parked robot sits on the planned path', () => {
    expect(pathClearOfRobots([0, 0], [10, 0], [[5, 0]], 1.0)).toBe(false)
  })

  it('returns true when parked robots are off to the side', () => {
    expect(pathClearOfRobots([0, 0], [10, 0], [[5, 3]], 1.0)).toBe(true)
  })

  it('returns false when a parked robot is within margin of an endpoint', () => {
    expect(pathClearOfRobots([0, 0], [10, 0], [[10.5, 0]], 1.0)).toBe(false)
  })
})
