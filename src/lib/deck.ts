import type { LanguageFile } from './wordData'

export interface Card {
  /** Stable ID used for stats: `<lang>:<level>:<word>` (SPEC §3.3). */
  id: string
  word: string
  short: string
  /** Full translation, or '' when it is the same as `short`. */
  full: string
  level: number
}

export type Direction = 'forward' | 'reverse' | 'mixed'
/** A fixed number of cards, every card in range once, or until stopped. */
export type SessionLength = number | 'all' | 'endless'

export type Rng = () => number

export function toCards(file: LanguageFile): Card[] {
  return file.cards.map(([word, short, full, level]) => ({
    id: `${file.code}:${level}:${word}`,
    word,
    short,
    full,
    level,
  }))
}

/** Cards whose level is within [min, max]; the bounds may come in either order. */
export function inRange(cards: readonly Card[], a: number, b: number): Card[] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return cards.filter((c) => c.level >= lo && c.level <= hi)
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The opening queue for a shuffled-deck session (SPEC §6.2): no card repeats
 * until every card in range has been shown. Fixed lengths are capped at the
 * deck size; endless sessions start with one full deck and call `refill`.
 */
export function startQueue(cards: readonly Card[], length: SessionLength, rng: Rng = Math.random): Card[] {
  const deck = shuffle(cards, rng)
  return typeof length === 'number' ? deck.slice(0, length) : deck
}

/**
 * A fresh shuffled deck for an endless session, arranged so its first card is
 * not the card just shown.
 */
export function refill(cards: readonly Card[], lastId: string | undefined, rng: Rng = Math.random): Card[] {
  const deck = shuffle(cards, rng)
  if (deck.length > 1 && deck[0].id === lastId) {
    const j = 1 + Math.floor(rng() * (deck.length - 1))
    ;[deck[0], deck[j]] = [deck[j], deck[0]]
  }
  return deck
}

/** Number of cards a session will show, or null for endless. */
export function plannedCount(available: number, length: SessionLength): number | null {
  if (length === 'endless') return null
  if (length === 'all') return available
  return Math.min(length, available)
}

/** Which side is the prompt for one card: true = foreign word on the front. */
export function promptIsForeign(direction: Direction, rng: Rng = Math.random): boolean {
  if (direction === 'forward') return true
  if (direction === 'reverse') return false
  return rng() < 0.5
}
