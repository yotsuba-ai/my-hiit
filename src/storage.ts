import { preset, validWorkout, type Workout } from './workout.ts'

const STORAGE_KEY = 'my-hiit-workouts-v1'

export function loadWorkouts(): Workout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [preset]
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [preset]
    const ids = new Set([preset.id])
    const saved = parsed.filter(validWorkout).filter((w: Workout) => {
      if (ids.has(w.id)) return false
      ids.add(w.id)
      return true
    })
    return [preset, ...saved]
  } catch {
    return [preset]
  }
}

export function saveWorkouts(workouts: Workout[]): boolean {
  try {
    if (!workouts.every(validWorkout)) return false
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workouts.filter(w => w.id !== preset.id)))
    return true
  } catch {
    return false
  }
}
