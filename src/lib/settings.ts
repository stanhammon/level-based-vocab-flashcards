import type { Direction, SessionLength } from './deck'
import { SELECTIONS, type Selection } from './selection'
import { load, save } from './storage'
import type { LanguageInfo } from './wordData'

export interface SessionSettings {
  min: number
  max: number
  direction: Direction
  selection: Selection
  length: SessionLength
  /** Only starred words (signed-in users). */
  starredOnly: boolean
}

export const LENGTH_CHOICES: SessionLength[] = [10, 20, 50, 'all', 'endless']

export function defaultSettings(lang: LanguageInfo): SessionSettings {
  return {
    min: lang.minLevel,
    max: Math.min(lang.maxLevel, lang.minLevel + 9),
    direction: 'forward',
    selection: 'shuffled',
    length: 20,
    starredOnly: false,
  }
}

const clampLevel = (n: number, lang: LanguageInfo) =>
  Math.min(lang.maxLevel, Math.max(lang.minLevel, Math.round(n)))

/** Saved settings for a language, repaired if the word list has changed since. */
export function loadSettings(lang: LanguageInfo): SessionSettings {
  const saved = load<Partial<SessionSettings>>(`settings:${lang.code}`, {})
  const base = defaultSettings(lang)
  const s = { ...base, ...saved }
  if (typeof s.min !== 'number' || typeof s.max !== 'number') return base
  if (!['forward', 'reverse', 'mixed'].includes(s.direction)) s.direction = base.direction
  if (!LENGTH_CHOICES.includes(s.length)) s.length = base.length
  if (!SELECTIONS.some((x) => x.value === s.selection)) s.selection = base.selection
  s.starredOnly = s.starredOnly === true
  s.min = clampLevel(s.min, lang)
  s.max = clampLevel(s.max, lang)
  return s
}

export function saveSettings(code: string, s: SessionSettings): void {
  save(`settings:${code}`, s)
}

export const loadLastLanguage = () => load<string | null>('lastLanguage', null)
export const saveLastLanguage = (code: string) => save('lastLanguage', code)
