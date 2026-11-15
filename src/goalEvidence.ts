import { buildGoalWeeks, paceLabel, usesPacePractice, validGoal, type GoalConfig } from './goals.ts'
import { buildTimeline, type Workout } from './workout.ts'

export const nhsPlanUrl = 'https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/'
export const baaPlanUrl = 'https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/'

export function workoutDose(workout: Workout) {
  const timeline = buildTimeline(workout)
  return {
    runningSeconds: timeline.filter(s => s.kind === 'work').reduce((sum, s) => sum + s.durationMs / 1000, 0),
    recoverySeconds: timeline.filter(s => s.kind === 'rest').reduce((sum, s) => sum + s.durationMs / 1000, 0),
    preparationSeconds: workout.warmupSeconds + workout.cooldownSeconds,
    totalSeconds: (timeline.at(-1)?.endMs ?? 0) / 1000,
  }
}

export function goalEvidence(g: GoalConfig) {
  if (!validGoal(g)) throw new Error('Invalid goal configuration')
  const targetPace = g.targetMinutes / g.distanceKm
  const currentPace = g.current3kmMinutes === null ? null : g.current3kmMinutes / 3
  const paceReductionPercent = currentPace === null ? null : (1 - targetPace / currentPace) * 100
  const speedIncreasePercent = currentPace === null ? null : (currentPace / targetPace - 1) * 100
  let reason: string
  if (g.level === 'beginner') reason = '「20分は続かない」を選んだため、走歩を交互に行う基礎づくりを選択しました。現在の3kmタイムが入力されていても、この走力設定を優先します。'
  else if (g.level === 'steady') reason = '「20分は楽に走れる」を選んだため、楽な連続走を選択しました。週2回以上の走習慣と30分の連続走を、このアプリではペース練習を表示する条件にしています。'
  else if (currentPace === null) reason = '走る習慣はありますが、現在の3kmタイムが未入力なので目標との差を計算できません。今回は楽な連続走を選択しました。'
  else if (usesPacePractice(g)) reason = `走習慣があり、入力タイムから計算した1kmあたりの時間短縮率が15%以下のため、週1回の短いペース練習を表示しました。これは表示を振り分ける独自ルールです。${g.weeks}週間で達成できるという判定ではありません。`
  else reason = `入力タイムから計算した1kmあたりの時間短縮率が${paceReductionPercent!.toFixed(1)}%で、独自の15%条件を超えるため、楽な連続走を選択しました。15%は研究で確認された達成可能性の境界ではありません。`
  const weeks = buildGoalWeeks(g).map(week => {
    const doses = week.sessions.map(s => workoutDose(s.workout))
    return {
      week: week.week,
      runningSeconds: doses.reduce((sum, s) => sum + s.runningSeconds, 0),
      walkingAndRecoverySeconds: doses.reduce((sum, s) => sum + s.recoverySeconds + s.preparationSeconds, 0),
      totalSeconds: doses.reduce((sum, s) => sum + s.totalSeconds, 0),
      longestRunSeconds: Math.max(...week.sessions.map(s => s.workout.workSeconds)),
    }
  })
  const final = weeks.at(-1)!
  return {
    targetPace, targetSpeedKmh: 60 / targetPace, currentPace,
    paceGapSeconds: currentPace === null ? null : (currentPace - targetPace) * 60,
    paceReductionPercent, speedIncreasePercent, reason, weeks,
    planName: g.level === 'beginner' ? '走歩による基礎づくり' : usesPacePractice(g) ? '連続走＋短いペース練習' : '楽な連続走による基礎づくり',
    finalContinuousMinutes: final.longestRunSeconds / 60,
    targetPaceLabel: paceLabel(targetPace),
    totalSessions: g.weeks * g.daysPerWeek,
    totalSeconds: weeks.reduce((sum, w) => sum + w.totalSeconds, 0),
  }
}
