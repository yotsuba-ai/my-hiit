import { useEffect, useState } from 'react'

type InstallEvent = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: string }>
}

export default function PwaPanel() {
  const [status, setStatus] = useState('オフライン利用の準備中…')
  const [install, setInstall] = useState<InstallEvent | null>(null)
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    let disposed = false
    const sync = () => setOnline(navigator.onLine)
    const offer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent) }
    const installed = () => setInstall(null)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', installed)
    if (!import.meta.env.PROD) setStatus('開発モード：オフライン機能は本番ビルドで有効です')
    else if (!('serviceWorker' in navigator) || !window.isSecureContext) {
      setStatus('オフライン利用にはHTTPS接続が必要です')
    } else {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
        .then(() => navigator.serviceWorker.ready)
        .then(() => { if (!disposed) setStatus('オフライン利用の準備ができました') })
        .catch(() => { if (!disposed) setStatus('オフラインの準備に失敗しました。オンラインで再読み込みしてください') })
    }
    return () => {
      disposed = true
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])
  return <section className="pwa-panel" aria-label="アプリのインストール">
    <div><strong>ホーム画面から、すぐにトレーニング。</strong><p role="status">{online ? '' : 'オフライン · '}{status}</p></div>
    {install && <button className="button-secondary" onClick={async () => {
      try { await install.prompt(); await install.userChoice } catch { /* manual steps remain available */ }
      finally { setInstall(null) }
    }}>アプリを追加</button>}
    <details><summary>ホーム画面への追加方法</summary><p>iPhone：Safariの共有メニューから「ホーム画面に追加」。Android：Chromeのメニューから「アプリをインストール」または「ホーム画面に追加」。</p><p>「オフライン利用の準備ができました」の表示を確認してから利用してください。保存メニューはこのブラウザ内に残り、ブラウザのデータを消去すると削除されます。</p></details>
  </section>
}
