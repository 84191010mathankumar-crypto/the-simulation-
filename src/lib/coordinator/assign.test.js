import { describe, it, expect } from 'vitest'
import { assignNearestPending } from './assign.js'

describe('assignNearestPending', () => {
  it('returns empty when there are no robots', () => {
    expect(assignNearestPending([], [{ id: 't1', from: [0, 0] }])).toEqual([])
  })

  it('returns empty when there are no tasks', () => {
    expect(assignNearestPending([{ id: 'r1', position: [0, 0] }], [])).toEqual([])
  })

  it('gives a single robot the closer of two tasks', () => {
    const result = assignNearestPending(
      [{ id: 'r1', position: [0, 0] }],
      [{ id: 't1', from: [10, 0] }, { id: 't2', from: [3, 0] }],
    )
    expect(result).toEqual([{ robotId: 'r1', taskId: 't2' }])
  })

  it('never assigns the same task to two robots', () => {
    const result = assignNearestPending(
      [{ id: 'r1', position: [0, 0] }, { id: 'r2', position: [0, 1] }],
      [{ id: 't1', from: [5, 0] }],
    )
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('t1')
  })

  it('pairs each robot with its nearest distinct task when supply matches demand', () => {
    const result = assignNearestPending(
      [
        { id: 'r1', position: [-5, 0] },
        { id: 'r2', position: [ 5, 0] },
      ],
      [
        { id: 'tL', from: [-4, 0] },   // close to r1
        { id: 'tR', from: [ 4, 0] },   // close to r2
      ],
    )
    const map = Object.fromEntries(result.map((p) => [p.robotId, p.taskId]))
    expect(map).toEqual({ r1: 'tL', r2: 'tR' })
  })

  it('leaves extra robots unassigned when tasks run out', () => {
    const result = assignNearestPending(
      [{ id: 'r1', position: [0, 0] }, { id: 'r2', position: [10, 10] }],
      [{ id: 't1', from: [1, 1] }],
    )
    expect(result).toHaveLength(1)
    expect(result[0].robotId).toBe('r1')          // closer one wins
  })

  it('with one robot returns a single assignment regardless of task count', () => {
    const result = assignNearestPending(
      [{ id: 'r1', position: [0, 0] }],
      [
        { id: 't1', from: [10, 0] },
        { id: 't2', from: [ 5, 0] },
        { id: 't3', from: [20, 0] },
      ],
    )
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('t2')
  })

  it('breaks ties deterministically (first pair seen wins)', () => {
    // Two robots equidistant from one task.
    const result = assignNearestPending(
      [{ id: 'r1', position: [-3, 0] }, { id: 'r2', position: [3, 0] }],
      [{ id: 't1', from: [0, 0] }],
    )
    expect(result).toHaveLength(1)
    // The sort is stable on equal keys; r1's pair is enumerated first.
    expect(result[0].robotId).toBe('r1')
  })
})
