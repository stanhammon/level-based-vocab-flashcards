/**
 * Card order modes (SPEC §6.3). Pure functions: the quiz screen owns the
 * session state and calls these to plan or extend its queue.
 *
 * In every mode a card's direction is decided first, and only that
 * direction's stats count (SPEC §6.2).
 */
import { promptIsForeign, type Card, type Direction, type Rng } from './deck'
import { statKey, type Stat, type StatDirection } from './stats'

export type Selection = 'shuffled' | 'random' | 'weighted' | 'srs'

export const SELECTIONS: { value: Selection; label: string; hint: string }[] = [
  { value: 'shuffled', label: 'Shuffled deck — no repeats', hint: 'Every word in range once before any repeats.' },
  { value: 'random', label: 'Random', hint: 'Any word in range each time. Repeats can happen.' },
  { value: 'weighted', label: 'Weighted toward misses', hint: 'Words you miss more often come up more.' },
  { value: 'srs', label: 'Spaced repetition', hint: 'Words due for review first, then new ones.' },
]

/** One card as it will be shown: which side is the prompt. */
export interface Shown {
  card: Card
  foreign: boolean
}

export const dirOf = (foreign: boolean): StatDirection => (foreign ? 'forward' : 'reverse')
export const statFor = (stats: ReadonlyMap<string, Stat>, s: Shown) => stats.get(statKey(s.card.id, dirOf(s.foreign)))

/** Uniform pick, never the card just shown (unless it is the only one). */
export function pickRandom(pool: readonly Card[], direction: Direction, lastId: string | undefined, rng: Rng): Shown {
  const candidates = pool.length > 1 ? pool.filter((c) => c.id !== lastId) : pool
  const card = candidates[Math.floor(rng() * candidates.length)]
  return { card, foreign: promptIsForeign(direction, rng) }
}

/** Weight for "weighted toward misses": 1 + 4 × miss rate, +1 for a word never seen. */
export function missWeight(stat: Stat | undefined): number {
  if (!stat || stat.seen === 0) return 2
  return 1 + (4 * stat.missed) / Math.max(stat.seen, 1)
}

/** Weighted pick: direction first, then that direction's miss rate sets the odds. */
export function pickWeighted(
  pool: readonly Card[],
  direction: Direction,
  stats: ReadonlyMap<string, Stat>,
  lastId: string | undefined,
  rng: Rng,
): Shown {
  const foreign = promptIsForeign(direction, rng)
  const dir = dirOf(foreign)
  const candidates = pool.length > 1 ? pool.filter((c) => c.id !== lastId) : pool
  const weights = candidates.map((c) => missWeight(stats.get(statKey(c.id, dir))))
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r < 0) return { card: candidates[i], foreign }
  }
  return { card: candidates[candidates.length - 1], foreign }
}

/**
 * Spaced-repetition plan (Leitner): due cards first, most overdue first, then
 * cards never seen in their direction, in section order. Cards seen but not
 * yet due are left out.
 */
export function planSrs(
  pool: readonly Card[],
  direction: Direction,
  stats: ReadonlyMap<string, Stat>,
  now: number,
  rng: Rng,
): { due: Shown[]; fresh: Shown[] } {
  const due: { s: Shown; at: number }[] = []
  const fresh: Shown[] = []
  for (const card of pool) {
    const s: Shown = { card, foreign: promptIsForeign(direction, rng) }
    const stat = statFor(stats, s)
    if (!stat) fresh.push(s)
    else if (stat.dueAt <= now) due.push({ s, at: stat.dueAt })
  }
  due.sort((a, b) => a.at - b.at)
  // pool is already in CSV order, which is section order.
  return { due: due.map((d) => d.s), fresh }
}

/** How many times a missed card may come back within one SRS session. */
export const MAX_RETRIES = 3

/**
 * Where a missed SRS card comes back: a few cards later (3–5), or at the end
 * of a short queue. `index` is the position of the card just graded.
 */
export function retryPosition(index: number, queueLength: number, rng: Rng): number {
  const gap = 3 + Math.floor(rng() * 3)
  return Math.min(index + 1 + gap, queueLength)
}
