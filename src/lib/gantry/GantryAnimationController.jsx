import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TRAVEL_Y, HOME_POSE } from './useGantryStore'
import { useGantryRobotStore } from './gantryContext'
import { easeInOutCubic } from '../ik/ikSolver'

// Seconds per motion segment. The full sequence is:
//   moving_to_start → descending_pick → grabbing → ascending_pick →
//   moving_to_end → rotating → descending_place → releasing →
//   ascending_place → returning → idle
const SPEED = {
  moving_to_start:   1.4,
  descending_pick:   2.4,   // 6 m rail → longer vertical travel needs more time
  grabbing:          0.35,
  ascending_pick:    2.4,
  moving_to_end:      1.4,
  rotating:           0.6,
  descending_place:   2.4,
  releasing:          0.35,
  ascending_place:    2.4,
  returning:          1.8,  // return includes vertical lift from pick/place height
}

const SEQUENCE = {
  moving_to_start:  'descending_pick',
  descending_pick:  'grabbing',
  grabbing:         'ascending_pick',
  ascending_pick:   'moving_to_end',
  moving_to_end:    'rotating',
  rotating:         'descending_place',
  descending_place: 'releasing',
  releasing:        'ascending_place',
  ascending_place:  'returning',
  returning:        'idle',
}

function lerpPose(a, b, t) {
  return {
    x:    a.x    + (b.x    - a.x)    * t,
    y:    a.y    + (b.y    - a.y)    * t,
    z:    a.z    + (b.z    - a.z)    * t,
    rotY: a.rotY + (b.rotY - a.rotY) * t,
  }
}

/** Headless component — drives the gantry's pose through the pick-and-place
 * sequence. No inverse kinematics needed: each segment is a straight-line
 * interpolation between two {x,y,z,rotY} poses. */
export default function GantryAnimationController() {
  const progressRef  = useRef(0)
  const prevStateRef = useRef('idle')
  const segmentRef    = useRef({ from: { ...HOME_POSE }, to: { ...HOME_POSE } })
  const useStore = useGantryRobotStore()

  useFrame((_, delta) => {
    const store = useStore.getState()
    const { animState, pose, startObject, endObject } = store

    if (animState === 'idle') {
      prevStateRef.current = 'idle'
      progressRef.current = 0
      return
    }

    // First frame of a new segment: figure out where it starts and ends.
    if (prevStateRef.current !== animState) {
      prevStateRef.current = animState
      progressRef.current = 0
      useStore.setState({ animProgress: 0 })

      const from = { ...pose }
      let to = { ...pose }

      switch (animState) {
        case 'moving_to_start':
          to = { x: startObject.position[0], y: TRAVEL_Y, z: startObject.position[2], rotY: startObject.rotY }
          store.addLog('info', 'Moving to START position…')
          break
        case 'descending_pick':
          to = { ...from, y: startObject.position[1] }
          store.addLog('info', 'Descending to pick height…')
          break
        case 'grabbing':
          useStore.setState({ gripperOpen: false, carrying: true })
          store.addLog('ok', '✓ Object grabbed')
          break
        case 'ascending_pick':
          to = { ...from, y: TRAVEL_Y }
          store.addLog('info', 'Lifting…')
          break
        case 'moving_to_end':
          to = { x: endObject.position[0], y: TRAVEL_Y, z: endObject.position[2], rotY: from.rotY }
          store.addLog('info', 'Moving to END position…')
          break
        case 'rotating':
          to = { ...from, rotY: endObject.rotY }
          store.addLog('info', `Rotating object to ${Math.round((endObject.rotY * 180) / Math.PI)}°…`)
          break
        case 'descending_place':
          to = { ...from, y: endObject.position[1] }
          store.addLog('info', 'Descending to place height…')
          break
        case 'releasing':
          useStore.setState({ gripperOpen: true, carrying: false })
          store.addLog('ok', '✓ Object released')
          break
        case 'ascending_place':
          to = { ...from, y: TRAVEL_Y }
          store.addLog('info', 'Lifting…')
          break
        case 'returning':
          to = { ...HOME_POSE }
          store.addLog('info', 'Returning HOME…')
          break
        default:
          break
      }

      segmentRef.current = { from, to }
      return
    }

    const duration = SPEED[animState] || 0.6
    progressRef.current = Math.min(1, progressRef.current + delta / duration)
    const t = easeInOutCubic(progressRef.current)

    // Single batched write per frame (pose + progress) — one notify pass.
    const { from, to } = segmentRef.current
    useStore.setState({ animProgress: progressRef.current, pose: lerpPose(from, to, t) })

    if (progressRef.current >= 1) {
      const next = SEQUENCE[animState] || 'idle'
      if (animState === 'returning') store.addLog('ok', '✓ HOME — sequence complete')
      useStore.setState({ animState: next })
    }
  })

  return null
}
