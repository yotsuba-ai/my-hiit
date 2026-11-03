let audioContext: AudioContext | null = null

export function primeAudio(): void {
  try {
    audioContext ??= new AudioContext()
    void audioContext.resume()
  } catch {
    // Some browsers do not support Web Audio or block it until a user gesture.
  }
}

export function announce(message: string, voiceEnabled: boolean, soundEnabled: boolean): void {
  if (soundEnabled && audioContext) {
    try {
      const now = audioContext.currentTime
      for (let i = 0; i < 2; i++) {
        const oscillator = audioContext.createOscillator()
        const gain = audioContext.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.value = i === 0 ? 660 : 880
        gain.gain.setValueAtTime(0.0001, now + i * 0.16)
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.16 + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.13)
        oscillator.connect(gain).connect(audioContext.destination)
        oscillator.start(now + i * 0.16)
        oscillator.stop(now + i * 0.16 + 0.14)
      }
    } catch { /* audio is optional */ }
  }
  if (voiceEnabled && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = 'ja-JP'
      utterance.rate = 1.05
      speechSynthesis.speak(utterance)
    } catch { /* speech is optional */ }
  }
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel()
}
