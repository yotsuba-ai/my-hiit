import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoalWeeks, goalDefaults, usesPacePractice, validGoal, paceLabel, loadGoal, saveGoal } from '../src/goals.ts'
import { buildTimeline, validWorkout } from '../src/workout.ts'

test('six-week 3km/15min goal has 18 beginner sessions and 5min/km reference', () => {
  const weeks = buildGoalWeeks(goalDefaults)
  assert.equal(weeks.length, 6)
  assert.equal(weeks.flatMap(w => w.sessions).length, 18)
  assert.equal(paceLabel(15 / 3), '5分00秒/km')
  assert.equal(usesPacePractice(goalDefaults), false)
  assert(weeks.every(w => w.sessions.every(s => s.title.includes('歩く'))))
})

test('beginner plan advances slowly without prescribing target pace', () => {
  const weeks = buildGoalWeeks(goalDefaults)
  assert.equal(weeks[0].sessions[0].workout.workSeconds, 60)
  assert.equal(weeks[1].sessions[0].workout.workSeconds, 60)
  assert.equal(weeks[2].sessions[0].workout.workSeconds, 90)
  assert.equal(weeks[5].sessions[0].workout.workSeconds, 120)
  for (const week of weeks) for (const s of week.sessions) {
    assert.equal(s.workout.restSeconds, 90)
    assert(!s.workout.exercises[0].name.includes('/km'))
  }
})

test('experienced runners with comparable current pace get one quality session a week', () => {
  const goal = { ...goalDefaults, level: 'regular', current3kmMinutes: 17 }
  assert.equal(usesPacePractice(goal), true)
  const weeks = buildGoalWeeks(goal)
  for (const week of weeks) {
    assert.equal(week.sessions.filter(s => s.title === '短いペース練習').length, 1)
    assert.equal(week.sessions.filter(s => s.title === '楽なランニング').length, 2)
  }
  assert(weeks.at(-1).sessions[1].workout.rounds < weeks[0].sessions[1].workout.rounds)
})

test('unknown current pace, large gap or limited baseline never trigger speed practice', () => {
  for (const update of [{ level: 'regular', current3kmMinutes: null },
    { level: 'regular', current3kmMinutes: 25 }, { level: 'steady', current3kmMinutes: 17 }]) {
    const goal = { ...goalDefaults, ...update }
    assert.equal(usesPacePractice(goal), false)
    assert(buildGoalWeeks(goal).every(w => w.sessions.every(s => !s.title.includes('ペース'))))
  }
})

test('all supported durations and frequencies generate valid continuous timelines', () => {
  for (const weeks of [6, 9, 12]) for (const daysPerWeek of [2, 3]) for (const level of ['beginner', 'steady', 'regular']) {
    const goal = { ...goalDefaults, weeks, daysPerWeek, level, current3kmMinutes: 17 }
    const result = buildGoalWeeks(goal)
    const ids = new Set()
    for (const week of result) {
      assert.equal(week.sessions.length, daysPerWeek)
      for (const session of week.sessions) {
        assert.equal(validWorkout(session.workout), true)
        assert(!ids.has(session.id)); ids.add(session.id)
        const timeline = buildTimeline(session.workout)
        assert.equal(timeline[0].kind, 'warmup')
        assert.equal(timeline[0].durationMs, 300000)
        assert.equal(timeline.at(-1).kind, 'cooldown')
        timeline.forEach((segment, i) => assert.equal(segment.startMs, i ? timeline[i - 1].endMs : 0))
      }
    }
  }
})

test('invalid inputs are rejected rather than producing an aggressive or broken plan', () => {
  for (const update of [{ distanceKm: 0 }, { distanceKm: 42 }, { targetMinutes: NaN }, { targetMinutes: 0 },
    { targetMinutes: 5 }, { weeks: 6.5 }, { weeks: 0 }, { weeks: 13 }, { daysPerWeek: 7 },
    { level: 'unknown' }, { current3kmMinutes: 0 }, { current3kmMinutes: Infinity }]) {
    const goal = { ...goalDefaults, ...update }
    assert.equal(validGoal(goal), false)
    assert.throws(() => buildGoalWeeks(goal))
  }
  assert(validGoal({ ...goalDefaults, distanceKm: 1, targetMinutes: 5 }))
  assert(validGoal({ ...goalDefaults, distanceKm: 5, targetMinutes: 30 }))
})

test('goal and checked sessions survive reload; corrupt ids and duplicate entries are filtered', () => {
  const memory = new Map()
  globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) }
  const plan = { config: goalDefaults, completed: ['week-1-session-1'] }
  assert.equal(saveGoal(plan), true)
  assert.deepEqual(loadGoal(), plan)
  memory.set('my-hiit-goal-v1', JSON.stringify({ ...plan, completed: ['week-1-session-1', 'unknown', 'week-1-session-1'] }))
  assert.deepEqual(loadGoal().completed, ['week-1-session-1'])
  memory.set('my-hiit-goal-v1', '{broken')
  assert.equal(loadGoal(), null)
  memory.set('my-hiit-goal-v1', JSON.stringify({ ...plan, config: { ...goalDefaults, weeks: 100000 } }))
  assert.equal(loadGoal(), null)
})

test('storage failures return errors without claiming a saved goal', () => {
  globalThis.localStorage = { getItem() { throw Error('disabled') }, setItem() { throw Error('quota') } }
  assert.equal(loadGoal(), null)
  assert.equal(saveGoal({ config: goalDefaults, completed: [] }), false)
})
