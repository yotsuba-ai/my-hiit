import { useMemo, useState } from 'react'
import { buildTimeline, formatDuration, type Workout } from './workout'
import GoalRationale from './GoalRationale'
import { workoutDose } from './goalEvidence'
import { buildGoalWeeks, goalDefaults, goalGuidance, loadGoal, paceLabel, saveGoal, validGoal,
  type GoalConfig, type GoalPlan } from './goals'

export default function GoalMode({ onStart }: { onStart: (workout: Workout) => void }) {
  const [saved, setSaved] = useState<GoalPlan | null>(loadGoal)
  const [draft, setDraft] = useState<GoalConfig>(() => saved?.config ?? { ...goalDefaults })
  const [editing, setEditing] = useState(!saved)
  const [weekIndex, setWeekIndex] = useState(0)
  const [message, setMessage] = useState('')
  const weeks = useMemo(() => saved ? buildGoalWeeks(saved.config) : [], [saved?.config])
  const current = weeks[weekIndex]
  const patch = (update: Partial<GoalConfig>) => setDraft(prev => ({ ...prev, ...update }))

  function createPlan() {
    if (!validGoal(draft)) { setMessage('数値を確認してください。目標ペースは3〜15分/km、期間は6〜12週間に対応しています。'); return }
    const unchanged = saved && JSON.stringify(saved.config) === JSON.stringify(draft)
    const plan = { config: { ...draft }, completed: unchanged ? saved.completed : [] }
    if (!saveGoal(plan)) { setMessage('保存できませんでした。ブラウザの保存設定や空き容量を確認してください。'); return }
    setSaved(plan); setEditing(false); setWeekIndex(0); setMessage('目標と計画をこの端末に保存しました。')
  }
  function toggleCompleted(id: string) {
    if (!saved) return
    const next = { ...saved, completed: saved.completed.includes(id)
      ? saved.completed.filter(item => item !== id) : [...saved.completed, id] }
    if (!saveGoal(next)) { setMessage('実施記録を保存できませんでした。'); return }
    setSaved(next); setMessage('実施記録を保存しました。')
  }
  return <main className="goal-main">
    <div className="page-heading"><span className="section-kicker">YOUR NEXT MILESTONE</span>
      <h1>目標から、今日の一歩へ。</h1><p>少ない回数で、続けられるランニング計画を。</p></div>
    {message && <p className="feedback" role="status">{message}</p>}
    {editing && <form className="edit-panel goal-form" onSubmit={e => { e.preventDefault(); createPlan() }}>
      <h2>目標を設定する</h2><p className="goal-muted">例：6週間で3kmを15分。現在の走力は、無理なく走れる時間を選んでください。</p>
      <div className="goal-fields">
        <label>目標距離<select value={draft.distanceKm} onChange={e => patch({ distanceKm: Number(e.target.value) })}>
          <option value={1}>1km</option><option value={3}>3km</option><option value={5}>5km</option></select></label>
        <label>目標タイム（分）<input type="number" inputMode="decimal" required min={5} max={60} step={0.5} value={draft.targetMinutes || ''}
          onChange={e => patch({ targetMinutes: Number(e.target.value) })} /></label>
        <label>期間（週間）<input type="number" inputMode="numeric" required min={6} max={12} step={1} value={draft.weeks || ''}
          onChange={e => patch({ weeks: Number(e.target.value) })} /></label>
        <label>走る回数<select value={draft.daysPerWeek} onChange={e => patch({ daysPerWeek: Number(e.target.value) as 2 | 3 })}>
          <option value={2}>週2回</option><option value={3}>週3回</option></select></label>
        <label>現在の走力<select value={draft.level} onChange={e => patch({ level: e.target.value as GoalConfig['level'] })}>
          <option value="beginner">20分は続かない</option><option value="steady">20分は続けて楽に走れる</option><option value="regular">30分以上・週2回以上</option></select></label>
        <label>現在の3kmタイム（分・任意）<input type="number" inputMode="decimal" min={9} max={60} step={0.5}
          placeholder="未計測なら空欄" value={draft.current3kmMinutes ?? ''}
          onChange={e => patch({ current3kmMinutes: e.target.value === '' ? null : Number(e.target.value) })} /></label>
      </div>
      <p className="goal-muted">運動日の間に1日以上休む想定です。週2回なら月・木、週3回なら月・水・土など、都合に合わせてください。</p>
      {saved && <p className="goal-muted">条件を変えて作り直すと、これまでの実施チェックはリセットされます。</p>}
      {validGoal(draft) && <GoalRationale config={draft} compact />}
      <div className="goal-buttons"><button className="save-button" type="submit">{saved ? 'この条件で計画を保存する' : '計画を作って保存する'}</button>
        {saved && <button className="button-secondary" type="button" onClick={() => { setEditing(false); setDraft(saved.config); setMessage('') }}>キャンセル</button>}</div>
    </form>}
    {saved && !editing && <>
      <section className="goal-summary"><div><span className="section-kicker">希望する目標</span>
        <h2>{saved.config.weeks}週間で、{saved.config.distanceKm}kmを{saved.config.targetMinutes}分。</h2>
        <p>目標ペース <strong>{paceLabel(saved.config.targetMinutes / saved.config.distanceKm)}</strong> · 週{saved.config.daysPerWeek}回</p></div>
        <button className="button-secondary" onClick={() => { setDraft(saved.config); setEditing(true); setMessage('') }}>目標を変更</button>
        <p className="goal-guidance">{goalGuidance(saved.config)}</p>
        <div className="goal-progress"><span>計画の実施 {saved.completed.length} / {weeks.length * saved.config.daysPerWeek}回</span>
          <progress aria-label="計画の実施回数" value={saved.completed.length} max={weeks.length * saved.config.daysPerWeek} /></div>
        <p className="goal-muted">達成を保証する「最低限の量」は個人差があるため算出できません。この計画は少ない回数で取り組む目安です。</p>
      </section>
      <GoalRationale config={saved.config} />
      <nav className="week-tabs" aria-label="計画の週を選ぶ">{weeks.map((week, i) => <button key={week.week}
        className={weekIndex === i ? 'selected' : ''} aria-pressed={weekIndex === i} onClick={() => setWeekIndex(i)}>
        {week.week}週目 <small>{week.sessions.filter(s => saved.completed.includes(s.id)).length}/{week.sessions.length}</small></button>)}</nav>
      {current && <section className="goal-week"><div className="section-heading"><div><span className="section-kicker">WEEK {current.week}</span>
        <h2>{current.focus}</h2></div></div>
        <div className="goal-session-grid">{current.sessions.map((session, i) => {
          const seconds = (buildTimeline(session.workout).at(-1)?.endMs ?? 0) / 1000
          const dose = workoutDose(session.workout)
          return <article className="goal-session" key={session.id}>
            <span className="section-kicker">SESSION {i + 1}</span><h3>{session.title}</h3>
            <strong className="goal-duration">{formatDuration(seconds)}</strong><p>{session.detail}</p>
            <p className="goal-muted">走る時間 {formatDuration(dose.runningSeconds)}／回復 {formatDuration(dose.recoverySeconds)}／前後の歩き {formatDuration(dose.preparationSeconds)}。前後は各5分です。</p>
            <button className="start-button" onClick={() => onStart(session.workout)}>このメニューを開始 →</button>
            <label className="goal-completed"><input type="checkbox" checked={saved.completed.includes(session.id)}
              onChange={() => toggleCompleted(session.id)} /> この練習を実施した</label>
          </article>
        })}</div>
        <p className="goal-muted">休憩区間は歩く時間です。負担が強ければ次の週に進まず、同じ週を繰り返すか休んでください。実施チェックは自己申告で、タイム達成の判定とは別です。</p>
        {current.week === saved.config.weeks && <p className="feedback">最終週は振り返りの週です。目標の距離・タイムは、回復した日に実測して確認してください。距離やペースをGPSで計測する機能はありません。</p>}
      </section>}
    </>}
    <details className="goal-notes"><summary>計画の考え方・調整方法</summary>
      <p>HIITは補助として使い、走る目標には実際に走る練習を中心にします。痛みや強い疲労がある日は休み、休んだ分をまとめて取り返さないでください。</p>
      <p>初心者は短い走りと歩きから始めます。走る習慣があり、現在の3kmタイムが入力され、目標ペースとの差が小さい場合にだけ週1回のペース練習を提案します。数値による振り分けはこのアプリ独自の目安です。</p>
      <p>参考：<a href="https://www.nhs.uk/better-health/get-active/get-running-with-couch-to-5k/couch-to-5k-running-plan/" target="_blank" rel="noreferrer">NHSの初心者向け計画</a>、
        <a href="https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/" target="_blank" rel="noreferrer">B.A.A.のランニング計画</a>。
        走歩・休養・楽なランニングといった基本方針を参考にした独自の計画案で、出典の公式メニューや個別指導を再現したものではありません。</p>
    </details>
  </main>
}
