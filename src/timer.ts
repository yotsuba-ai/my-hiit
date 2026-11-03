export type TimerState = {
  status: 'ready' | 'running' | 'paused' | 'done'
  baseMs: number
  startedAt: number | null
}

export function elapsedAt(state: TimerState, totalMs: number, now = Date.now()): number {
  const delta = state.status === 'running' && state.startedAt !== null
    ? Math.max(0, now - state.startedAt) : 0
  return Math.max(0, Math.min(totalMs, state.baseMs + delta))
}

export function skipAt(state: TimerState, ends: number[], now = Date.now()): TimerState {
  const total = ends.at(-1) ?? 0
  const elapsed = elapsedAt(state, total, now)
  const target = ends.find(end => end > elapsed) ?? total
  if (target >= total) return { status: 'done', baseMs: total, startedAt: null }
  return { status: state.status === 'paused' ? 'paused' : 'running', baseMs: target,
    startedAt: state.status === 'paused' ? null : now }
}
