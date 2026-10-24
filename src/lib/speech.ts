import { useSyncExternalStore } from 'react'
import { useOnline } from './online'

/**
 * Pronunciation with the browser's speech synthesis (SPEC §8). Voices are
 * matched to the language's preferred locales in order (e.g. es-MX, es-US,
 * es). With no matching voice, callers hide the speaker buttons instead of
 * reading the word with the wrong language's voice.
 */

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Voices load asynchronously and the browser announces them once, often before
// React mounts, so they are tracked here from the start.
let voices: SpeechSynthesisVoice[] = supported ? speechSynthesis.getVoices() : []
const listeners = new Set<() => void>()
if (supported) {
  speechSynthesis.addEventListener('voiceschanged', () => {
    voices = speechSynthesis.getVoices()
    listeners.forEach((l) => l())
  })
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()

export function findVoice(
  list: SpeechSynthesisVoice[],
  locales: string[],
  localOnly = false,
): SpeechSynthesisVoice | null {
  for (const want of locales.map(norm)) {
    const matches = list.filter((v) => {
      if (localOnly && !v.localService) return false
      const l = norm(v.lang)
      return want.includes('-') ? l === want : l === want || l.startsWith(want + '-')
    })
    // Prefer voices installed on the device: they work offline.
    const best = matches.find((v) => v.localService) ?? matches[0]
    if (best) return best
  }
  return null
}

/**
 * The best voice for these locales, or null. Offline, only voices installed on
 * the device count, since online voices can't speak without a connection.
 */
export function useVoice(locales: string[]): SpeechSynthesisVoice | null {
  const list = useSyncExternalStore(subscribe, () => voices)
  const online = useOnline()
  return findVoice(list, locales, !online)
}

export function speak(text: string, voice: SpeechSynthesisVoice) {
  if (!supported) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = 0.9
  speechSynthesis.speak(u)
}
