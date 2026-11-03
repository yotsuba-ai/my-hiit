export type Exercise = { id: string; name: string }
export type Workout = {
  id: string
  name: string
  workSeconds: number
  restSeconds: number
  rounds: number
  warmupSeconds: number
  cooldownSeconds: number
  exercises: Exercise[]
}

export type Segment = {
  key: string
  kind: 'warmup' | 'work' | 'rest' | 'cooldown'
  label: string
  durationMs: number
  round?: number
  exerciseIndex?: number
  startMs: number
  endMs: number
}

export const preset: Workout = {
  id: 'cardio-low-arm',
  name: '心肺持久力・低腕負荷',
  workSeconds: 40,
  restSeconds: 20,
  rounds: 3,
  warmupSeconds: 60,
  cooldownSeconds: 60,
  exercises: [
    { id: 'high-knees', name: 'ハイニー' },
    { id: 'squats', name: 'ノーマルスクワット' },
    { id: 'fast-feet', name: 'ファストフィート' },
    { id: 'reverse-lunge', name: 'リバースランジ' },
  ],
}

export function buildTimeline(workout: Workout): Segment[] {
  const segments: Segment[] = []
  let elapsed = 0
  const add = (kind: Segment['kind'], label: string, seconds: number, round?: number, exerciseIndex?: number) => {
    if (seconds <= 0) return
    const durationMs = seconds * 1000
    segments.push({ key: `${kind}-${round ?? 0}-${exerciseIndex ?? 0}`, kind, label, durationMs, round, exerciseIndex, startMs: elapsed, endMs: elapsed + durationMs })
    elapsed += durationMs
  }
  add('warmup', 'ウォームアップ', workout.warmupSeconds)
  for (let round = 1; round <= workout.rounds; round++) {
    workout.exercises.forEach((exercise, exerciseIndex) => {
      add('work', exercise.name, workout.workSeconds, round, exerciseIndex)
      add('rest', '休憩', workout.restSeconds, round, exerciseIndex)
    })
  }
  add('cooldown', 'クールダウン', workout.cooldownSeconds)
  return segments
}

export function formatSeconds(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}分${rest}秒` : `${minutes}分`
}

export function validWorkout(value: unknown): value is Workout {
  if (!value || typeof value !== 'object') return false
  const w = value as Partial<Workout>
  const inRange = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max
  return typeof w.id === 'string' && w.id.trim().length > 0 && typeof w.name === 'string' && w.name.trim().length > 0 && w.name.length <= 80
    && inRange(w.workSeconds, 1, 3600) && inRange(w.restSeconds, 0, 3600)
    && inRange(w.rounds, 1, 99) && inRange(w.warmupSeconds, 0, 3600) && inRange(w.cooldownSeconds, 0, 3600)
    && Array.isArray(w.exercises) && w.exercises.length > 0 && w.exercises.length <= 50
    && w.exercises.every(e => e && typeof e.id === 'string' && e.id.trim().length > 0 && typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length <= 80)
    && new Set(w.exercises.map(e => e.id)).size === w.exercises.length
}
