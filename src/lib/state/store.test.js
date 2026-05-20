import { describe, it, expect } from 'vitest'
import { createRobotStore } from './store.jsx'
import { HOME_ANGLES, JOINT_NAMES } from './constants.js'

describe('createRobotStore — initial state', () => {
  it('starts with HOME_ANGLES on every joint', () => {
    const store = createRobotStore()
    expect(store.getState().jointAngles).toEqual(HOME_ANGLES)
  })

  it('starts idle with no animation segment', () => {
    const s = createRobotStore().getState()
    expect(s.animState).toBe('idle')
    expect(s.animProgress).toBe(0)
    expect(s.fromAngles).toBeNull()
    expect(s.toAngles).toBeNull()
  })

  it('starts in static-pedestal mode with platform at origin', () => {
    const s = createRobotStore().getState()
    expect(s.mobileMode).toBe(false)
    expect(s.platformPose).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0] })
  })

  it('starts with default start/end work objects', () => {
    const s = createRobotStore().getState()
    expect(s.startObject.position).toEqual([0.8, 0.4, 0.5])
    expect(s.endObject.position).toEqual([0.8, -0.4, 0.5])
  })

  it('starts with no robot loaded and an empty log', () => {
    const s = createRobotStore().getState()
    expect(s.robotLoaded).toBe(false)
    expect(s.robotRef).toBeNull()
    expect(s.logs).toEqual([])
  })
})

describe('createRobotStore — actions', () => {
  it('setAnimState transitions the state machine', () => {
    const store = createRobotStore()
    store.getState().setAnimState('moving_to_start')
    expect(store.getState().animState).toBe('moving_to_start')
  })

  it('setJointAngles copies, not aliases, the input', () => {
    const store = createRobotStore()
    const input = { ...HOME_ANGLES, joint_1: 1.0 }
    store.getState().setJointAngles(input)
    input.joint_1 = 999
    expect(store.getState().jointAngles.joint_1).toBe(1.0)
  })

  it('setStartObject patches without erasing other fields', () => {
    const store = createRobotStore()
    store.getState().setStartObject({ position: [1, 2, 3] })
    const s = store.getState().startObject
    expect(s.position).toEqual([1, 2, 3])
    expect(s.rotation).toEqual([0, 0, 0])      // untouched
    expect(s.grabVector).toEqual([0, 1, 0])    // untouched
  })

  it('addLog prepends entries with monotonically increasing ids', () => {
    const store = createRobotStore()
    store.getState().addLog('info', 'first')
    store.getState().addLog('ok', 'second')
    const logs = store.getState().logs
    expect(logs).toHaveLength(2)
    expect(logs[0].msg).toBe('second')         // newest first
    expect(logs[1].msg).toBe('first')
    expect(logs[0].id).toBeGreaterThan(logs[1].id)
  })

  it('addLog caps at 200 entries', () => {
    const store = createRobotStore()
    for (let i = 0; i < 250; i++) store.getState().addLog('info', `msg ${i}`)
    expect(store.getState().logs).toHaveLength(200)
    expect(store.getState().logs[0].msg).toBe('msg 249')   // newest survived
  })

  it('clearLogs empties the log', () => {
    const store = createRobotStore()
    store.getState().addLog('info', 'a')
    store.getState().clearLogs()
    expect(store.getState().logs).toEqual([])
  })

  it('resetToHome restores joint angles and idles the animation', () => {
    const store = createRobotStore()
    store.getState().setJointAngles({ ...HOME_ANGLES, joint_1: 1.2 })
    store.getState().setAnimState('moving_to_start')
    store.setState({ animProgress: 0.7 })
    store.getState().resetToHome()
    expect(store.getState().jointAngles).toEqual(HOME_ANGLES)
    expect(store.getState().animState).toBe('idle')
    expect(store.getState().animProgress).toBe(0)
  })
})

describe('createRobotStore — multi-robot isolation', () => {
  it('two stores have independent joint angles', () => {
    const a = createRobotStore()
    const b = createRobotStore()
    a.getState().setJointAngles({ ...HOME_ANGLES, joint_1: 1.0 })
    expect(a.getState().jointAngles.joint_1).toBe(1.0)
    expect(b.getState().jointAngles.joint_1).toBe(HOME_ANGLES.joint_1)
  })

  it('logs in store A do not leak into store B', () => {
    const a = createRobotStore()
    const b = createRobotStore()
    a.getState().addLog('info', 'a-event')
    b.getState().addLog('info', 'b-event')
    expect(a.getState().logs.map(l => l.msg)).toEqual(['a-event'])
    expect(b.getState().logs.map(l => l.msg)).toEqual(['b-event'])
  })

  it('per-store log ids start independently at 0', () => {
    const a = createRobotStore()
    const b = createRobotStore()
    a.getState().addLog('info', 'a')
    b.getState().addLog('info', 'b')
    expect(a.getState().logs[0].id).toBe(0)
    expect(b.getState().logs[0].id).toBe(0)
  })

  it('animState changes in one store leave the other idle', () => {
    const a = createRobotStore()
    const b = createRobotStore()
    a.getState().setAnimState('moving_to_start')
    expect(a.getState().animState).toBe('moving_to_start')
    expect(b.getState().animState).toBe('idle')
  })
})

describe('createRobotStore — subscribeWithSelector middleware', () => {
  it('subscribe(selector, listener) only fires when the slice changes', () => {
    const store = createRobotStore()
    const fired = []
    const unsub = store.subscribe((s) => s.animState, (cur) => fired.push(cur))

    store.getState().addLog('info', 'unrelated')   // animState unchanged
    expect(fired).toEqual([])

    store.getState().setAnimState('moving_to_start')
    expect(fired).toEqual(['moving_to_start'])

    store.getState().setAnimState('grabbing')
    expect(fired).toEqual(['moving_to_start', 'grabbing'])

    unsub()
    store.getState().setAnimState('idle')
    expect(fired).toEqual(['moving_to_start', 'grabbing'])  // no more events
  })

  it('subscribe to jointAngles fires when angles change', () => {
    const store = createRobotStore()
    let lastAngles = null
    const unsub = store.subscribe((s) => s.jointAngles, (a) => { lastAngles = a })

    store.getState().setJointAngles({ ...HOME_ANGLES, joint_3: 2.0 })
    expect(lastAngles.joint_3).toBe(2.0)
    unsub()
  })
})

describe('constants', () => {
  it('JOINT_NAMES has six joints in order', () => {
    expect(JOINT_NAMES).toEqual([
      'joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6',
    ])
  })

  it('HOME_ANGLES covers every joint name', () => {
    for (const n of JOINT_NAMES) expect(HOME_ANGLES).toHaveProperty(n)
  })
})
