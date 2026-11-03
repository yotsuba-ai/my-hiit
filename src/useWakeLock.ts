import { useEffect, useState } from 'react'

export function useWakeLock(running: boolean) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!running || !('wakeLock' in navigator)) return
    let disposed = false
    let lock: WakeLockSentinel | null = null
    let pending = false
    const acquire = async () => {
      if (disposed || pending || lock || document.visibilityState !== 'visible') return
      pending = true
      try {
        const acquired = await navigator.wakeLock.request('screen')
        if (disposed) { await acquired.release(); return }
        lock = acquired
        setHeld(true)
        acquired.addEventListener('release', () => {
          if (lock === acquired) lock = null
          if (!disposed) setHeld(false)
        })
      } catch { if (!disposed) setHeld(false) }
      finally { pending = false }
    }
    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => {})
      setHeld(false)
    }
  }, [running])
  return held
}
