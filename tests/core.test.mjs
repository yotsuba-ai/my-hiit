import test from 'node:test'
import assert from 'node:assert/strict'
import { preset, buildTimeline, validWorkout, formatSeconds } from '../src/workout.ts'
import { elapsedAt, skipAt } from '../src/timer.ts'
import { loadWorkouts, saveWorkouts } from '../src/storage.ts'

test('preset totals 14 minutes with 12 work/rest pairs and continuous boundaries', () => {
  const timeline = buildTimeline(preset)
  assert.equal(timeline.at(-1).endMs, 840000)
  assert.equal(timeline.filter(s => s.kind === 'work').length, 12)
  assert.equal(timeline.filter(s => s.kind === 'rest').length, 12)
  assert.equal(timeline[1].label, 'ハイニー')
  timeline.forEach((segment, i) => assert.equal(segment.startMs, i ? timeline[i - 1].endMs : 0))
})
test('zero warmup/rest/cooldown omitted; custom order respected', () => {
  const timeline = buildTimeline({ ...preset, rounds: 1, warmupSeconds: 0, restSeconds: 0,
    cooldownSeconds: 0, exercises: [...preset.exercises].reverse() })
  assert.equal(timeline.length, 4)
  assert.equal(timeline[0].label, 'リバースランジ')
  assert.equal(timeline.at(-1).endMs, 160000)
})
test('delayed rendering catches up to wall time and clamps to completion', () => {
  const state = { status: 'running', baseMs: 5000, startedAt: 10000 }
  assert.equal(elapsedAt(state, 100000, 45000), 40000)
  assert.equal(elapsedAt(state, 100000, 900000), 100000)
  assert.equal(elapsedAt(state, 100000, 9999), 5000)
})
test('paused time remains unchanged, resume counts from its new anchor', () => {
  assert.equal(elapsedAt({ status: 'paused', baseMs: 7500, startedAt: null }, 100000, 999999), 7500)
  assert.equal(elapsedAt({ status: 'running', baseMs: 7500, startedAt: 90000 }, 100000, 91000), 8500)
})
test('skip uses actual time after a render delay and skips at exact boundaries', () => {
  assert.deepEqual(skipAt({ status: 'running', baseMs: 0, startedAt: 0 }, [1000, 2000, 3000], 1100),
    { status: 'running', baseMs: 2000, startedAt: 1100 })
  assert.equal(skipAt({ status: 'running', baseMs: 0, startedAt: 0 }, [1000, 2000, 3000], 1000).baseMs, 2000)
})
test('skip while paused stays paused and final skip completes immediately', () => {
  assert.deepEqual(skipAt({ status: 'paused', baseMs: 0, startedAt: null }, [1000, 2000]),
    { status: 'paused', baseMs: 1000, startedAt: null })
  assert.deepEqual(skipAt({ status: 'paused', baseMs: 1000, startedAt: null }, [1000, 2000]),
    { status: 'done', baseMs: 2000, startedAt: null })
})
test('invalid times, blank names and duplicate exercise ids rejected', () => {
  assert.equal(validWorkout(preset), true)
  for (const patch of [{ rounds: 1.5 }, { workSeconds: 0 }, { restSeconds: -1 }, { warmupSeconds: Infinity },
    { cooldownSeconds: 3601 }, { name: ' ' }, { exercises: [] }, { exercises: [preset.exercises[0], preset.exercises[0]] }]) {
    assert.equal(validWorkout({ ...preset, ...patch }), false)
  }
  assert.equal(formatSeconds(0.1), '00:01')
})
test('storage round trip, invalid data, duplicate ids and unavailable storage', () => {
  let value = null
  globalThis.localStorage = { getItem: () => value, setItem: (_key, next) => { value = next } }
  const custom = { ...preset, id: 'custom', name: '朝のメニュー' }
  assert.equal(saveWorkouts([preset, custom]), true)
  assert.deepEqual(loadWorkouts(), [preset, custom])
  value = JSON.stringify([custom, custom, { name: 'invalid' }])
  assert.equal(loadWorkouts().length, 2)
  value = '{broken'
  assert.deepEqual(loadWorkouts(), [preset])
  assert.equal(saveWorkouts([{ ...custom, rounds: 0.5 }]), false)
  globalThis.localStorage = { getItem() { throw Error('blocked') }, setItem() { throw Error('quota') } }
  assert.deepEqual(loadWorkouts(), [preset])
  assert.equal(saveWorkouts([custom]), false)
})
