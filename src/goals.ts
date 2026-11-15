import type { Workout } from './workout.ts'

export type GoalConfig = {
  distanceKm: number
  targetMinutes: number
  weeks: number
  daysPerWeek: 2 | 3
  level: 'beginner' | 'steady' | 'regular'
  current3kmMinutes: number | null
}
export type GoalSession = { id: string; title: string; detail: string; workout: Workout }
export type GoalWeek = { week: number; focus: string; sessions: GoalSession[] }
export type GoalPlan = { config: GoalConfig; completed: string[] }
export const goalDefaults: GoalConfig = {
  distanceKm: 3, targetMinutes: 15, weeks: 6, daysPerWeek: 3,
  level: 'beginner', current3kmMinutes: null,
}
const KEY = 'my-hiit-goal-v1'

export function validGoal(value: unknown): value is GoalConfig {
  if (!value || typeof value !== 'object') return false
  const g = value as GoalConfig
  const between = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi
  return [1, 3, 5].includes(g.distanceKm) && between(g.targetMinutes, 5, 60)
    && Number.isInteger(g.weeks) && between(g.weeks, 6, 12)
    && [2, 3].includes(g.daysPerWeek) && ['beginner', 'steady', 'regular'].includes(g.level)
    && (g.current3kmMinutes === null || between(g.current3kmMinutes, 9, 60))
    && between(g.targetMinutes / g.distanceKm, 3, 15)
}

export function paceLabel(minutesPerKm: number): string {
  const seconds = Math.round(minutesPerKm * 60)
  return `${Math.floor(seconds / 60)}分${String(seconds % 60).padStart(2, '0')}秒/km`
}

// These are conservative application templates, not a validated performance prediction.
export function usesPacePractice(g: GoalConfig): boolean {
  return g.level === 'regular' && g.current3kmMinutes !== null
    && g.targetMinutes / g.distanceKm >= (g.current3kmMinutes / 3) * 0.85
}

export function goalGuidance(g: GoalConfig): string {
  if (g.level === 'beginner') return 'まずは走る習慣と基礎体力を作る計画です。指定の期間で距離・タイムを達成できるとは限りません。速さを上げず、楽に繰り返せる週を続けてください。'
  if (g.current3kmMinutes === null) return '現在の3kmタイムが未入力のため、速いペースを指定せず、会話できる強さのランニングを組みます。'
  if (!usesPacePractice(g)) return '目標との差が大きい、または走る土台を作る段階のため、今回は基礎づくりを優先します。期間の延長や目標タイムの見直しも選べます。'
  return 'ゆっくり走る日を軸に、週1回だけ短いペース練習を入れます。目標ペースがきつい日は現在のペースまで落としてください。達成を予測する計画ではありません。'
}

export function buildGoalWeeks(g: GoalConfig): GoalWeek[] {
  if (!validGoal(g)) throw new Error('Invalid goal configuration')
  const pace = paceLabel(g.targetMinutes / g.distanceKm)
  const speedPractice = usesPacePractice(g)
  return Array.from({ length: g.weeks }, (_, index) => {
    const week = index + 1
    const finalWeek = week === g.weeks
    // Advance at most one stage every two weeks for the walk/run foundation.
    const beginnerStage = Math.min(4, Math.floor(index / 2))
    const session = (slot: number, title: string, label: string, seconds: number, rounds: number,
      rest: number, detail: string): GoalSession => ({
      id: `week-${week}-session-${slot}`, title, detail,
      workout: {
        id: `goal-${week}-${slot}`, name: `${week}週目・${title}`,
        warmupSeconds: 300, cooldownSeconds: 300, workSeconds: seconds,
        restSeconds: rest, rounds, exercises: [{ id: 'running', name: label }],
      },
    })
    if (g.level === 'beginner') {
      const work = [60, 90, 120, 150, 180][beginnerStage]
      const rounds = beginnerStage === 0 ? 7 : 6
      return { week, focus: '走歩で土台を作る', sessions: Array.from({ length: g.daysPerWeek }, (_, slot) =>
        session(slot + 1, 'ゆっくり走る・歩く', 'ゆっくりジョギング', work, rounds, 90,
          `走る${work}秒 → 歩く90秒を${rounds}回。会話できる強さで、走るのが難しければ歩きます。休憩表示中は歩いて回復。`)) }
    }
    const easyMinutes = finalWeek ? 15 : Math.min(g.level === 'regular' ? 30 : 22,
      (g.level === 'regular' ? 20 : 15) + Math.floor(index / 2) * 2)
    const easy = (slot: number) => session(slot, '楽なランニング', '会話できる強さで走る',
      easyMinutes * 60, 1, 0, `${easyMinutes}分を楽に。苦しくなれば歩き、無理にペースを維持しません。`)
    const sessions = [easy(1)]
    if (speedPractice) {
      const stage = Math.min(4, Math.floor(index * 5 / (g.weeks - 1)))
      const seconds = finalWeek ? 60 : [60, 90, 120, 120, 180][stage]
      const reps = finalWeek ? 4 : [6, 6, 5, 5, 4][stage]
      sessions.push(session(2, '短いペース練習', `目安 ${pace}・きつければ落とす`, seconds, reps, 120,
        `${seconds}秒走る → 2分歩く/ゆっくり走るを${reps}回。目安は${pace}。全力走はせず、余裕を残します。`))
    } else sessions.push(easy(2))
    if (g.daysPerWeek === 3) sessions.push(easy(3))
    return { week, focus: finalWeek ? '負荷を落として振り返る' : speedPractice ? '楽な走り＋短いペース練習' : '会話できる強さで基礎づくり', sessions }
  })
}

export function loadGoal(): GoalPlan | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const plan = value as GoalPlan
    if (!validGoal(plan.config) || !Array.isArray(plan.completed)) return null
    const ids = new Set(buildGoalWeeks(plan.config).flatMap(w => w.sessions.map(s => s.id)))
    return { config: plan.config, completed: [...new Set(plan.completed.filter(id => typeof id === 'string' && ids.has(id)))] }
  } catch { return null }
}

export function saveGoal(plan: GoalPlan): boolean {
  try {
    if (!validGoal(plan.config)) return false
    const ids = new Set(buildGoalWeeks(plan.config).flatMap(w => w.sessions.map(s => s.id)))
    if (!Array.isArray(plan.completed) || plan.completed.some(id => !ids.has(id))) return false
    localStorage.setItem(KEY, JSON.stringify(plan))
    return true
  } catch { return false }
}
