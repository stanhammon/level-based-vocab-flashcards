import { describe, expect, it } from 'vitest'
import { toCards } from '../deck'
import { missWeight, pickRandom, pickWeighted, planSrs, retryPosition } from '../selection'
import { applyGrade, statKey, type Stat } from '../stats'

function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cards = toCards({
  code: 'es',
  sections: { 1: 'A', 2: 'B' },
  cards: [
    ['uno', 'one', '', 1],
    ['dos', 'two', '', 1],
    ['tres', 'three', '', 2],
    ['cuatro', 'four', '', 2],
  ],
})
const DAY = 86_400_000
const now = Date.UTC(2026, 9, 25)

describe('pickRandom', () => {
  it('never repeats the card just shown', () => {
    const rng = seeded(1)
    let last: string | undefined
    for (let i = 0; i < 300; i++) {
      const s = pickRandom(cards, 'forward', last, rng)
      expect(s.card.id).not.toBe(last)
      last = s.card.id
    }
  })
  it('reaches every card and allows repeats later', () => {
    const rng = seeded(2)
    const seen = new Set(Array.from({ length: 100 }, () => pickRandom(cards, 'forward', undefined, rng).card.id))
    expect(seen.size).toBe(4)
  })
  it('works with a single card', () => {
    expect(pickRandom(cards.slice(0, 1), 'forward', 'es:1:uno', seeded(3)).card.id).toBe('es:1:uno')
  })
})

describe('missWeight', () => {
  it('favours unseen and often-missed words', () => {
    const perfect: Stat = { seen: 4, correct: 4, missed: 0, streak: 4, box: 4, dueAt: 0, lastSeenAt: 0 }
    const half: Stat = { ...perfect, correct: 2, missed: 2 }
    expect(missWeight(perfect)).toBe(1)
    expect(missWeight(undefined)).toBe(2)
    expect(missWeight(half)).toBe(3)
  })
})

describe('pickWeighted', () => {
  it('picks an often-missed word far more often, per direction', () => {
    const stats = new Map<string, Stat>()
    // "tres" always missed going forward, never missed going in reverse.
    let missed: Stat | undefined
    for (let i = 0; i < 5; i++) missed = applyGrade(missed, false, now)
    stats.set(statKey('es:2:tres', 'forward'), missed!)
    for (const c of cards) {
      let ok: Stat | undefined
      for (let i = 0; i < 5; i++) ok = applyGrade(ok, true, now)
      if (c.id !== 'es:2:tres') stats.set(statKey(c.id, 'forward'), ok!)
      stats.set(statKey(c.id, 'reverse'), ok!)
    }
    const count = (direction: 'forward' | 'reverse') => {
      const rng = seeded(4)
      let n = 0
      for (let i = 0; i < 2000; i++) if (pickWeighted(cards, direction, stats, undefined, rng).card.id === 'es:2:tres') n++
      return n / 2000
    }
    expect(count('forward')).toBeGreaterThan(0.55) // weight 5 vs 1+1+1
    expect(count('reverse')).toBeLessThan(0.35) // all equal: about a quarter
  })
})

describe('planSrs', () => {
  it('puts due cards first (most overdue first), then new cards in section order, skipping not-yet-due', () => {
    const stats = new Map<string, Stat>()
    const stat = (dueAt: number): Stat => ({ seen: 1, correct: 1, missed: 0, streak: 1, box: 1, dueAt, lastSeenAt: 0 })
    stats.set(statKey('es:1:uno', 'forward'), stat(now - DAY)) // due yesterday
    stats.set(statKey('es:2:cuatro', 'forward'), stat(now - 3 * DAY)) // more overdue
    stats.set(statKey('es:1:dos', 'forward'), stat(now + DAY)) // not due yet
    const { due, fresh } = planSrs(cards, 'forward', stats, now, seeded(5))
    expect(due.map((s) => s.card.word)).toEqual(['cuatro', 'uno'])
    expect(fresh.map((s) => s.card.word)).toEqual(['tres'])
  })

  it('treats each direction separately', () => {
    const stats = new Map<string, Stat>()
    for (const c of cards) stats.set(statKey(c.id, 'forward'), applyGrade(undefined, true, now))
    expect(planSrs(cards, 'forward', stats, now, seeded(6)).fresh).toHaveLength(0)
    expect(planSrs(cards, 'reverse', stats, now, seeded(6)).fresh).toHaveLength(4)
  })
})

describe('retryPosition', () => {
  it('brings a missed card back 3–5 cards later, or at the end', () => {
    const rng = seeded(7)
    for (let i = 0; i < 50; i++) {
      const p = retryPosition(2, 100, rng)
      expect(p).toBeGreaterThanOrEqual(6)
      expect(p).toBeLessThanOrEqual(8)
    }
    expect(retryPosition(2, 4, rng)).toBe(4)
  })
})
