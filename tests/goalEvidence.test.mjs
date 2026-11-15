import test from 'node:test'
import assert from 'node:assert/strict'
import { goalEvidence, workoutDose } from '../src/goalEvidence.ts'
import { goalDefaults, buildGoalWeeks } from '../src/goals.ts'

test('goal pace and speed are arithmetic; missing baseline yields no progress estimate', () => {
  const result = goalEvidence(goalDefaults)
  assert.equal(result.targetPace, 5)
  assert.equal(result.targetSpeedKmh, 12)
  assert.equal(result.currentPace, null)
  assert.equal(result.paceGapSeconds, null)
  assert.equal(result.paceReductionPercent, null)
  assert.equal(result.speedIncreasePercent, null)
  assert.equal(result.finalContinuousMinutes, 2)
  assert.equal(result.totalSessions, 18)
})

test('time reduction and speed increase are distinct quantities for 17 to 15 minutes', () => {
  const result = goalEvidence({ ...goalDefaults, level: 'regular', current3kmMinutes: 17 })
  assert(Math.abs(result.paceGapSeconds - 40) < 1e-9)
  assert.equal(result.paceReductionPercent.toFixed(1), '11.8')
  assert.equal(result.speedIncreasePercent.toFixed(1), '13.3')
  assert.match(result.reason, /独自ルール/)
  assert.match(result.reason, /達成できるという判定ではありません/)
})

test('comparison handles equal and slower targets without inventing a need to improve', () => {
  const equal = goalEvidence({ ...goalDefaults, current3kmMinutes: 15 })
  assert.equal(equal.paceGapSeconds, 0)
  assert.equal(equal.speedIncreasePercent, 0)
  const slower = goalEvidence({ ...goalDefaults, current3kmMinutes: 12 })
  assert(slower.paceGapSeconds < 0)
  assert(slower.paceReductionPercent < 0)
  assert(slower.speedIncreasePercent < 0)
})

test('dose totals match actual timer segments including final recovery', () => {
  const first = buildGoalWeeks(goalDefaults)[0].sessions[0].workout
  assert.deepEqual(workoutDose(first), {
    runningSeconds: 420, recoverySeconds: 630, preparationSeconds: 600, totalSeconds: 1650,
  })
  const result = goalEvidence(goalDefaults)
  assert.equal(result.weeks[0].runningSeconds, 1260)
  assert.equal(result.weeks[0].walkingAndRecoverySeconds, 3690)
  assert.equal(result.weeks[0].totalSeconds, 4950)
  assert.equal(result.totalSeconds, 519 * 60)
  for (const week of result.weeks) assert.equal(week.runningSeconds + week.walkingAndRecoverySeconds, week.totalSeconds)
})

test('selection reason matches branch and uses the declared baseline distance', () => {
  for (const level of ['beginner', 'steady', 'regular']) {
    const result = goalEvidence({ ...goalDefaults, level })
    assert(result.reason.length > 0)
  }
  const largeGap = goalEvidence({ ...goalDefaults, level: 'regular', current3kmMinutes: 25 })
  assert.match(largeGap.reason, /40.0%/)
  assert.match(largeGap.reason, /研究で確認された/)
  const otherDistance = goalEvidence({ ...goalDefaults, distanceKm: 5, targetMinutes: 25, current3kmMinutes: 18 })
  assert.equal(otherDistance.currentPace, 6)
  assert.equal(otherDistance.targetPace, 5)
  assert.equal(otherDistance.currentPace * 3, 18)
  assert.throws(() => goalEvidence({ ...goalDefaults, weeks: 0 }))
})
