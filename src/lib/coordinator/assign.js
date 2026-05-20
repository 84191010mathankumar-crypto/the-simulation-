/**
 * Task-to-robot assignment.
 *
 * `assignNearestPending` is a greedy single-step heuristic:
 *   given a set of idle robots and pending tasks, hand each idle robot the
 *   pending task whose pickup point is closest to it — without giving two
 *   robots the same task.
 *
 * It's not globally optimal (Hungarian / auction methods would be); for the
 * warehouse demo's task counts (≤ ~20) the visual difference is negligible.
 */
import { dist2D } from './geometry.js'

/**
 * @param {Array<{id: string, position: [number, number]}>} idleRobots
 *        Robots currently free to take work, with their xz position.
 * @param {Array<{id: string, from: [number, number]}>} pendingTasks
 *        Tasks not yet assigned, with their pickup xz position.
 * @returns {Array<{robotId: string, taskId: string}>}
 *        One entry per robot that got a task this round.  A robot is omitted
 *        if no task was left to give.
 */
export function assignNearestPending(idleRobots, pendingTasks) {
  if (idleRobots.length === 0 || pendingTasks.length === 0) return []

  // Score every (robot, task) pair, then take greedy smallest-first.
  const pairs = []
  for (const r of idleRobots) {
    for (const t of pendingTasks) {
      pairs.push({ robotId: r.id, taskId: t.id, d: dist2D(r.position, t.from) })
    }
  }
  pairs.sort((a, b) => a.d - b.d)

  const takenRobots = new Set()
  const takenTasks = new Set()
  const result = []
  for (const p of pairs) {
    if (takenRobots.has(p.robotId)) continue
    if (takenTasks.has(p.taskId)) continue
    takenRobots.add(p.robotId)
    takenTasks.add(p.taskId)
    result.push({ robotId: p.robotId, taskId: p.taskId })
  }
  return result
}
