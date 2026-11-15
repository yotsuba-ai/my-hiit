import { goalEvidence, nhsPlanUrl, baaPlanUrl } from './goalEvidence'
import { paceLabel, type GoalConfig } from './goals'
import { formatDuration } from './workout'

export default function GoalRationale({ config, compact = false }: { config: GoalConfig; compact?: boolean }) {
  const evidence = goalEvidence(config)
  const percent = (n: number) => `${Math.abs(n).toFixed(1)}%`
  return <section className="goal-rationale" aria-label="目標と計画の根拠">
    <span className="section-kicker">WHY THIS PLAN</span><h2>この目標と計画の根拠</h2>
    <p className="evidence-verdict"><strong>達成可能性：未評価</strong><br />
      {config.weeks}週間・{config.distanceKm}km・{config.targetMinutes}分は、入力された希望条件です（初期値は例）。
      現在の情報から、この期間で達成できることや必要な最小練習量は算出していません。</p>
    <div className="evidence-grid">
      <article><span className="evidence-tag">計算で分かること</span><h3>目標に必要なペース</h3>
        <strong className="evidence-number">{evidence.targetPaceLabel}</strong>
        <p>{config.targetMinutes}分 ÷ {config.distanceKm}km ＝ {evidence.targetPaceLabel}。速度は約{evidence.targetSpeedKmh.toFixed(1)}km/hです。</p>
        <p>これは目標の換算値で、毎回の練習で維持するペースではありません。</p></article>
      <article><span className="evidence-tag">自己申告タイムとの比較</span><h3>今の走力との差</h3>
        {evidence.currentPace === null ? <><strong className="evidence-number">未計測・未入力</strong>
          <p>現在の3kmタイムがないため、目標との差は計算できません。「目標を変更」から入力できます。</p></> : <>
          <strong className="evidence-number">現在 {paceLabel(evidence.currentPace)}</strong>
          <p>現在3kmを{config.current3kmMinutes}分 → 1kmあたり{paceLabel(evidence.currentPace)}。</p>
          <p>{Math.abs(evidence.paceGapSeconds!) < 0.01 ? '目標と現在の平均ペースは同じです。' :
            evidence.paceGapSeconds! > 0 ? `目標は1kmあたり${Math.abs(evidence.paceGapSeconds!).toFixed(1)}秒短く、所要時間は${percent(evidence.paceReductionPercent!)}短縮、速度は${percent(evidence.speedIncreasePercent!)}増が必要です。` :
              `目標は現在の平均ペースより1kmあたり${Math.abs(evidence.paceGapSeconds!).toFixed(1)}秒ゆっくりです。`}</p>
          {config.distanceKm !== 3 && <p>現在の記録は3kmです。距離が異なるため、目標距離での予測タイムには換算していません。</p>}
          <p>入力値の計算比較です。測定日やコース条件、運動時の負担は評価していません。</p>
        </>}</article>
    </div>
    <article className="evidence-selection"><span className="evidence-tag">今回の選択理由</span>
      <h3>{evidence.planName}</h3><p>{evidence.reason}</p>
      <p>この計画で最終週に行う最長の連続走は<strong>{evidence.finalContinuousMinutes}分</strong>です。
        {config.level === 'beginner' ? `歩きを挟む練習の到達点です。${config.distanceKm}kmを止まらず${config.targetMinutes}分で走る準備が完了した、という意味にはなりません。` :
          '時間設定上の練習内容で、目標ペースで走れる時間や到達予測を示しません。'}</p>
    </article>
    {!compact && <>
      <div className="evidence-source"><h3>資料で裏付けられる範囲</h3>
        <p><a href={nhsPlanUrl} target="_blank" rel="noreferrer">NHS：Couch to 5K</a> — 初心者に走歩の交互練習、週3回、走る日の間の休養、前後各5分の歩きを示す9週間の計画です。到達点は30分の連続走で、3kmを15分にする計画ではありません。</p>
        <p><a href={baaPlanUrl} target="_blank" rel="noreferrer">B.A.A.：5K Training</a> — 楽なランニングとペース練習を組み合わせる参考です。5km向けの別の計画で、このアプリの練習量や6週間の目標を検証した資料ではありません。</p>
      </div>
      <div className="evidence-source"><h3>アプリ独自の設定</h3>
        <p>週2回の選択肢、練習の秒数・反復回数・週ごとの増やし方、ペース練習の週1回制限、最終週の軽減、15%の振り分け条件は独自設定です。この組み合わせが必要十分な量であることを示す検証はありません。</p>
        <p>現在の仕組みは走力別の固定テンプレートです。目標ペースと現在ペースの差で練習の種類を振り分けますが、目標達成に必要な練習量を逆算していません。同じ種類の計画では、距離やタイムを変えても練習時間は自動では増減しません。</p>
      </div>
      <details className="evidence-dose"><summary>全{config.weeks}週間の練習量を確認（{evidence.totalSessions}回・合計{formatDuration(evidence.totalSeconds)}）</summary>
        <div className="evidence-table-wrap"><table><caption>実際のタイマー設定から計算した週ごとの内訳</caption>
          <thead><tr><th scope="col">週</th><th scope="col">走る時間</th><th scope="col">歩き・回復・前後</th><th scope="col">合計</th></tr></thead>
          <tbody>{evidence.weeks.map(week => <tr key={week.week}><th scope="row">{week.week}</th><td>{formatDuration(week.runningSeconds)}</td>
            <td>{formatDuration(week.walkingAndRecoverySeconds)}</td><td>{formatDuration(week.totalSeconds)}</td></tr>)}</tbody></table></div>
        <p>回復区間には歩き、またはゆっくり走る時間を含みます。この表の量は設定内容の集計で、目標達成に必要な最低量の証明ではありません。</p>
      </details>
    </>}
  </section>
}
