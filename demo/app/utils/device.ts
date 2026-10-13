// Thin wrappers over browser APIs; every one degrades to a no-op when unsupported.

export const voiceOn = ref(true)

export function say(text: string) {
  if (!voiceOn.value || !('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'fr-FR'
  u.rate = 0.92
  const fr = speechSynthesis.getVoices().find(v => v.lang.startsWith('fr'))
  if (fr) u.voice = fr
  speechSynthesis.speak(u)
}

export const buzz = (p: number | number[] = 200) => navigator.vibrate?.(p)

export function listen(): Promise<string> {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) return Promise.reject(new Error('unsupported'))
  return new Promise((resolve, reject) => {
    const r = new SR()
    r.lang = 'fr-FR'
    r.interimResults = false
    r.onresult = (e: any) => resolve(e.results[0][0].transcript)
    r.onerror = reject
    r.onend = () => reject(new Error('nothing heard'))
    r.start()
  })
}

let lock: any
export async function keepAwake(on: boolean) {
  try {
    if (on) lock = await (navigator as any).wakeLock?.request('screen')
    else await lock?.release()
  }
  catch { /* not critical */ }
}
