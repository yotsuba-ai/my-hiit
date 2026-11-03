import { useEffect, useMemo, useRef, useState } from 'react'
import { announce, primeAudio, stopSpeech } from './alerts'
import { loadWorkouts, saveWorkouts } from './storage'
import { buildTimeline, formatDuration, formatSeconds, preset, type Workout } from './workout'
import { validWorkout } from './workout'
import { elapsedAt, skipAt, type TimerState } from './timer'
import { useWakeLock } from './useWakeLock'
import PwaPanel from './PwaPanel'

type View = 'home' | 'editor' | 'session'

const cloneWorkout = (w: Workout): Workout => ({ ...w, exercises: w.exercises.map(e => ({ ...e })) })
const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, React.ReactNode> = {
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    back: <><path d="M19 12H5m6 6-6-6 6-6"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    edit: <><path d="M12 20h9"/><path d="m16.5 3.5 4 4L9 19l-5 1 1-5L16.5 3.5Z"/></>,
    trash: <><path d="M4 7h16M10 11v7m4-7v7M6 7l1 14h10l1-14M9 7V4h6v3"/></>,
    up: <path d="m6 15 6-6 6 6"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    skip: <><path d="m5 5 10 7-10 7V5Zm13 0v14"/></>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
    check: <path d="m4 12 5 5L20 6"/>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function durationOf(w: Workout) {
  return w.warmupSeconds + w.cooldownSeconds + w.rounds * w.exercises.length * (w.workSeconds + w.restSeconds)
}

function NumberField({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return <label className="number-field"><span>{label}</span><div className="number-input"><input type="number" inputMode="numeric" min={min} max={max} step={1} value={text} onChange={e => {
    const raw = e.target.value
    setText(raw)
    const n = Number(raw)
    if (raw !== '' && Number.isInteger(n) && n >= min && n <= max) onChange(n)
  }} onBlur={() => {
    const n = Math.min(max, Math.max(min, Math.trunc(Number(text)) || 0))
    setText(String(n)); onChange(n)
  }} /><small>{suffix}</small></div></label>
}

export default function App() {
  const [workouts, setWorkouts] = useState<Workout[]>(loadWorkouts)
  const [view, setView] = useState<View>('home')
  const [selected, setSelected] = useState<Workout>(preset)
  const [draft, setDraft] = useState<Workout>(cloneWorkout(preset))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [timer, setTimer] = useState<TimerState>({ status: 'ready', baseMs: 0, startedAt: null })
  const [elapsedMs, setElapsedMs] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const wakeLockHeld = useWakeLock(timer.status === 'running')
  const lastAnnounced = useRef<string | null>(null)
  const timeline = useMemo(() => buildTimeline(selected), [selected])
  const totalMs = timeline.at(-1)?.endMs ?? 0
  const actualElapsed = (state: TimerState) => elapsedAt(state, totalMs)

  useEffect(() => {
    if (timer.status !== 'running') return
    const update = () => setElapsedMs(actualElapsed(timer))
    update()
    const interval = window.setInterval(update, 100)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update) }
  }, [timer, totalMs])

  const activeIndex = elapsedMs < totalMs ? timeline.findIndex(s => elapsedMs < s.endMs) : -1
  const active = activeIndex >= 0 ? timeline[activeIndex] : null
  const next = activeIndex >= 0 ? timeline[activeIndex + 1] : null
  const upcomingExercise = activeIndex >= 0 ? timeline.slice(activeIndex + 1).find(s => s.kind === 'work') : null
  const remaining = active ? (active.endMs - elapsedMs) / 1000 : 0

  useEffect(() => {
    if (timer.status !== 'running') return
    if (elapsedMs >= totalMs) {
      setTimer({ status: 'done', baseMs: totalMs, startedAt: null })
      if (lastAnnounced.current !== 'done') {
        lastAnnounced.current = 'done'
        announce('お疲れさまでした', voiceEnabled, soundEnabled)
      }
      return
    }
    if (active && lastAnnounced.current !== active.key) {
      lastAnnounced.current = active.key
      announce(active.kind === 'work' ? `${active.label}、スタート` : active.label, voiceEnabled, soundEnabled)
    }
  }, [active, elapsedMs, soundEnabled, voiceEnabled, timer.status, totalMs])

  function startWorkout(w: Workout) {
    primeAudio()
    stopSpeech()
    lastAnnounced.current = null
    setSelected(cloneWorkout(w))
    setElapsedMs(0)
    setTimer({ status: 'running', baseMs: 0, startedAt: Date.now() })
    setView('session')
  }
  function pauseOrResume() {
    if (timer.status === 'running') {
      const elapsed = actualElapsed(timer)
      setElapsedMs(elapsed)
      setTimer({ status: elapsed >= totalMs ? 'done' : 'paused', baseMs: elapsed, startedAt: null })
      stopSpeech()
    } else if (timer.status === 'paused') {
      primeAudio()
      setTimer({ status: 'running', baseMs: timer.baseMs, startedAt: Date.now() })
    }
  }
  function skip() {
    const state = skipAt(timer, timeline.map(s => s.endMs))
    setElapsedMs(state.baseMs)
    setTimer(state)
    if (state.status === 'done') {
      lastAnnounced.current = 'done'
      announce('お疲れさまでした', voiceEnabled, soundEnabled)
    }
  }
  function reset() {
    stopSpeech()
    lastAnnounced.current = null
    setElapsedMs(0)
    setTimer({ status: 'ready', baseMs: 0, startedAt: null })
  }
  function openEditor(w?: Workout) {
    setDraft(cloneWorkout(w ?? { ...preset, id: newId(), name: '新しいメニュー', exercises: preset.exercises.map(e => ({ ...e, id: newId() })) }))
    setEditingId(w && w.id !== preset.id ? w.id : null)
    setFeedback('')
    setView('editor')
  }
  function updateDraft(patch: Partial<Workout>) { setDraft(prev => ({ ...prev, ...patch })) }
  function saveDraft() {
    const name = draft.name.trim()
    if (!name || !draft.exercises.length || draft.exercises.some(e => !e.name.trim())) { setFeedback('メニュー名とすべての種目名を入力してください。'); return }
    const item = { ...draft, id: editingId ?? newId(), name, exercises: draft.exercises.map(e => ({ ...e, name: e.name.trim() })) }
    if (!validWorkout(item)) { setFeedback('時間と周回数には指定範囲の整数を入力してください。'); return }
    const updated = editingId ? workouts.map(w => w.id === editingId ? item : w) : [...workouts, item]
    if (!saveWorkouts(updated)) { setFeedback('保存できませんでした。ブラウザの保存設定をご確認ください。'); return }
    setWorkouts(updated)
    setView('home')
    setFeedback('メニューを保存しました。')
  }
  function deleteWorkout(id: string) {
    const updated = workouts.filter(w => w.id !== id)
    if (saveWorkouts(updated)) { setWorkouts(updated); setFeedback('メニューを削除しました。') }
    else setFeedback('削除を保存できませんでした。')
  }
  function moveExercise(index: number, direction: number) {
    const next = [...draft.exercises]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    updateDraft({ exercises: next })
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">M<span>.</span></span><span>MY HIIT</span></div><span className="topbar-right">MOVE AT YOUR PACE <span className="live-dot" /></span></header>

    {view === 'home' && <main className="home-main">
      <section className="hero"><div className="hero-grid" aria-hidden="true" /><div className="hero-content"><span className="eyebrow"><span className="eyebrow-line" /> YOUR TRAINING, YOUR RULES</span><h1>今日の自分に、<br /><em>ちょうどいい強さを。</em></h1><p>時間も、種目も、ペースも。<br />あなたに合わせて組み立てるHIITタイマー。</p><button className="hero-button" onClick={() => startWorkout(workouts[0])}><Icon name="play" size={20} /> プリセットで始める <Icon name="arrow" size={19} /></button><div className="hero-meta"><span>NO ACCOUNT NEEDED</span><span>·</span><span>WORKS OFFLINE</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-number">40<span>SEC</span></div><div className="art-caption">WORK / REST / REPEAT</div></div></section>
      <section className="section menus-section"><div className="section-heading"><div><span className="section-kicker">01 / YOUR ROUTINE</span><h2>メニューを選ぶ</h2><p>保存したメニューはここからすぐに開始できます。</p></div><button className="button-secondary add-menu" onClick={() => openEditor()}><Icon name="plus" size={19} /> 新しいメニュー</button></div>
        {feedback && <p className="feedback" role="status">{feedback}</p>}
        <div className="menu-grid">{workouts.map((w, index) => <article className={`menu-card ${index === 0 ? 'featured' : ''}`} key={w.id}><div className="card-top"><span className="card-index">{String(index + 1).padStart(2, '0')}</span><span className="pill">{index === 0 ? 'STARTER PRESET' : 'MY MENU'}</span></div><div className="card-body"><span className="card-type">{index === 0 ? 'CARDIO · LOW ARM LOAD' : 'CUSTOM WORKOUT'}</span><h3>{w.name}</h3><p className="exercise-preview">{w.exercises.map(e => e.name).join(' / ')}</p></div><div className="card-stats"><div><strong>{formatDuration(durationOf(w))}</strong><span>合計時間</span></div><div><strong>{w.exercises.length}</strong><span>種目数</span></div><div><strong>{w.rounds}</strong><span>周回数</span></div></div><div className="card-actions"><button className="start-button" onClick={() => startWorkout(w)}><Icon name="play" size={18} /> 開始する <Icon name="arrow" size={17} /></button><button className="icon-button" aria-label={`${w.name}を編集`} title="編集" onClick={() => openEditor(w)}><Icon name="edit" /></button>{index !== 0 && <button className="icon-button" aria-label={`${w.name}を削除`} title="削除" onClick={() => deleteWorkout(w.id)}><Icon name="trash" /></button>}</div></article>)}<button className="new-card" onClick={() => openEditor()}><span className="new-icon"><Icon name="plus" size={28} /></span><strong>自分だけのメニューを作る</strong><span>種目も時間も自由にカスタマイズ</span><span className="new-link">メニューを作成 <Icon name="arrow" size={16} /></span></button></div>
      </section>
      <PwaPanel /><section className="info-band"><div><span className="section-kicker">GOOD TO KNOW</span><h2>いつでも、どこでも。<br />自分のペースで。</h2></div><div className="info-copy"><p>メニューはこの端末のブラウザに保存されます。ホーム画面に追加すると、次回からアプリのように起動できます。一度オンラインで開いた後はオフラインでも使えます。</p><p>画面ロック中やバックグラウンドでは、端末・ブラウザの制限により音声や効果音が鳴らない場合があります。運動中は画面を開いたままご利用ください。</p></div></section>
    </main>}

    {view === 'editor' && <main className="editor-main"><button className="text-back" onClick={() => setView('home')}><Icon name="back" size={18} /> メニュー一覧に戻る</button><div className="page-heading"><span className="section-kicker">BUILD YOUR SESSION</span><h1>メニューを編集</h1><p>今日のコンディションに合わせて、自由に組み立てましょう。</p></div><div className="editor-layout"><div className="editor-primary"><section className="edit-panel"><div className="panel-heading"><span className="panel-number">01</span><div><h2>基本設定</h2><p>メニュー名と運動のサイクル</p></div></div><label className="text-field">メニュー名<input maxLength={80} value={draft.name} onChange={e => updateDraft({ name: e.target.value })} placeholder="例：朝の15分トレーニング" /></label><div className="field-grid"><NumberField label="運動時間" suffix="秒" min={1} max={3600} value={draft.workSeconds} onChange={n => updateDraft({ workSeconds: n })}/><NumberField label="休憩時間" suffix="秒" min={0} max={3600} value={draft.restSeconds} onChange={n => updateDraft({ restSeconds: n })}/><NumberField label="周回数" suffix="周" min={1} max={99} value={draft.rounds} onChange={n => updateDraft({ rounds: n })}/><NumberField label="ウォームアップ" suffix="秒" min={0} max={3600} value={draft.warmupSeconds} onChange={n => updateDraft({ warmupSeconds: n })}/><NumberField label="クールダウン" suffix="秒" min={0} max={3600} value={draft.cooldownSeconds} onChange={n => updateDraft({ cooldownSeconds: n })}/></div></section><section className="edit-panel"><div className="panel-heading"><span className="panel-number">02</span><div><h2>種目リスト</h2><p>矢印で順番を変更できます</p></div></div><div className="exercise-list">{draft.exercises.map((exercise, index) => <div className="exercise-row" key={exercise.id}><span className="exercise-order">{String(index + 1).padStart(2, '0')}</span><input aria-label={`種目${index + 1}の名前`} maxLength={80} value={exercise.name} onChange={e => updateDraft({ exercises: draft.exercises.map((item, i) => i === index ? { ...item, name: e.target.value } : item) })}/><div className="exercise-controls"><button aria-label={`${exercise.name}を上へ`} disabled={index === 0} onClick={() => moveExercise(index, -1)}><Icon name="up" size={18}/></button><button aria-label={`${exercise.name}を下へ`} disabled={index === draft.exercises.length - 1} onClick={() => moveExercise(index, 1)}><Icon name="down" size={18}/></button><button aria-label={`${exercise.name}を削除`} disabled={draft.exercises.length === 1} onClick={() => updateDraft({ exercises: draft.exercises.filter((_, i) => i !== index) })}><Icon name="trash" size={18}/></button></div></div>)}</div><button className="add-exercise" disabled={draft.exercises.length >= 50} onClick={() => updateDraft({ exercises: [...draft.exercises, { id: newId(), name: '' }] })}><Icon name="plus" size={18}/> 種目を追加</button></section></div><aside className="editor-sidebar"><div className="summary-panel"><span className="section-kicker">SESSION OVERVIEW</span><span className="summary-time">{formatDuration(durationOf(draft))}</span><span className="summary-label">合計トレーニング時間</span><div className="summary-divider" /><div className="summary-line"><span>種目</span><strong>{draft.exercises.length}種目</strong></div><div className="summary-line"><span>周回</span><strong>{draft.rounds}周</strong></div><div className="summary-line"><span>運動 / 休憩</span><strong>{draft.workSeconds}秒 / {draft.restSeconds}秒</strong></div><p>各種目の後に休憩を入れます。最終種目の後も休憩してから次の周回、またはクールダウンへ進みます。</p></div><button className="save-button" onClick={saveDraft}><Icon name="check" size={20}/> メニューを保存</button>{feedback && <p className="feedback error" role="alert">{feedback}</p>}</aside></div></main>}

    {view === 'session' && <main className="session-main"><div className="session-top"><button className="text-back" onClick={() => { reset(); setView('home') }}><Icon name="back" size={18}/> メニュー一覧</button><span className="session-name">{selected.name}</span></div><div className="session-layout"><section className={`timer-panel phase-${active?.kind ?? 'done'}`}><div className="timer-topline"><span className="eyebrow"><span className="eyebrow-line" /> LIVE SESSION</span><span className="session-state">{timer.status === 'paused' ? '一時停止中' : timer.status === 'done' ? '完了' : timer.status === 'ready' ? '準備完了' : '進行中'} <span className="live-dot"/></span></div><div className="timer-center"><span className="phase-label">{timer.status === 'done' ? 'WORKOUT COMPLETE' : active?.kind === 'work' ? 'WORK' : active?.kind === 'rest' ? 'REST' : active?.kind === 'warmup' ? 'WARM UP' : 'COOL DOWN'}</span><h1>{timer.status === 'done' ? 'お疲れさま！' : active?.label ?? '準備完了'}</h1><div className="timer-clock" aria-live="off">{timer.status === 'done' ? '00:00' : formatSeconds(remaining)}</div><p className="timer-hint">{timer.status === 'paused' ? '再開ボタンで続きからスタート' : timer.status === 'done' ? '今日のトレーニングが完了しました' : timer.status === 'ready' ? 'スタートボタンで開始' : '残り時間'}</p></div><div className="timer-bottom"><div className="progress-label"><span>全体の進捗</span><strong>{Math.round(totalMs ? elapsedMs / totalMs * 100 : 0)}%</strong></div><div className="progress-track" role="progressbar" aria-label="全体の進捗" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(totalMs ? elapsedMs / totalMs * 100 : 0)}><div style={{ width: `${totalMs ? elapsedMs / totalMs * 100 : 0}%` }} /></div><div className="timer-footer"><span>{formatSeconds(elapsedMs / 1000)} 経過</span><span>合計 {formatSeconds(totalMs / 1000)}</span></div></div></section><aside className="session-sidebar"><div className="next-panel"><span className="section-kicker">UP NEXT</span><strong>{timer.status === 'done' ? '完了' : next?.label ?? '終了'}</strong><span>{next ? `${formatSeconds(next.durationMs / 1000)} · ${next.kind === 'work' ? '運動' : next.kind === 'rest' ? '休憩' : next.kind === 'cooldown' ? 'クールダウン' : 'ウォームアップ'}` : '最後までお疲れさまです'}</span><div className="next-exercise"><span>次の種目</span><strong>{upcomingExercise?.label ?? 'なし'}</strong></div></div><div className="round-panel"><span>現在のラウンド</span><strong>{active?.round ?? (timer.status === 'done' ? selected.rounds : '—')}<small> / {selected.rounds}</small></strong><div className="round-dots">{Array.from({ length: Math.min(selected.rounds, 12) }, (_, i) => <span className={active?.round && i < active.round ? 'filled' : ''} key={i}/>)}</div></div><div className="settings-panel"><span className="section-kicker">NOTIFICATIONS</span><label><span>効果音</span><input type="checkbox" checked={soundEnabled} onChange={e => { if (e.target.checked) primeAudio(); setSoundEnabled(e.target.checked) }}/></label><label><span>音声案内</span><input type="checkbox" checked={voiceEnabled} onChange={e => { setVoiceEnabled(e.target.checked); if (!e.target.checked) stopSpeech() }}/></label></div></aside></div><div className="session-actions">{timer.status === 'ready' ? <button className="control-main" onClick={() => { primeAudio(); setTimer({ status: 'running', baseMs: 0, startedAt: Date.now() }) }}><Icon name="play"/> スタート</button> : timer.status === 'done' ? <button className="control-main" onClick={() => startWorkout(selected)}><Icon name="reset"/> もう一度</button> : <button className="control-main" onClick={pauseOrResume}><Icon name={timer.status === 'running' ? 'pause' : 'play'}/> {timer.status === 'running' ? '一時停止' : '再開'}</button>}<button className="control-secondary" disabled={timer.status === 'ready' || timer.status === 'done'} onClick={skip}><Icon name="skip"/> スキップ</button><button className="control-secondary" onClick={reset}><Icon name="reset"/> リセット</button></div><p className="session-note" role="status">{wakeLockHeld ? '画面の消灯を防止しています。' : '画面の消灯防止は無効です。必要に応じて端末の設定を変更してください。'}</p><p className="session-note">画面ロック中やバックグラウンドでは音声・効果音が鳴らない場合があります。タイマーは復帰時に実時刻で補正します。</p></main>}
    <footer className="footer"><span>MY HIIT <span className="footer-dot">●</span> MOVE AT YOUR PACE</span><span>BUILT FOR YOUR EVERYDAY MOVEMENT</span></footer>
  </div>
}
