import { describe, expect, it } from 'vitest'
import { inRange, plannedCount, promptIsForeign, refill, shuffle, startQueue, toCards, type Card } from '../deck'

/** Small seeded PRNG (mulberry32) so shuffles are reproducible. */
function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cards: Card[] = toCards({
  code: 'es',
  sections: { 1: 'Basics', 2: 'Numbers', 3: 'Colors' },
  cards: [
    ['hola', 'hello', 'hello, hi', 1],
    ['sí', 'yes', '', 1],
    ['uno', 'one', '', 2],
    ['dos', 'two', '', 2],
    ['tres', 'three', '', 2],
    ['rojo', 'red', '', 3],
  ],
})

describe('toCards', () => {
  it('builds stable IDs from language, level and word', () => {
    expect(cards[0]).toEqual({ id: 'es:1:hola', word: 'hola', short: 'hello', full: 'hello, hi', level: 1 })
  })
})

describe('inRange', () => {
  it('includes both bounds', () => {
    expect(inRange(cards, 2, 3).map((c) => c.word)).toEqual(['uno', 'dos', 'tres', 'rojo'])
  })
  it('accepts reversed bounds', () => {
    expect(inRange(cards, 2, 1)).toHaveLength(5)
  })
  it('is empty outside the data', () => {
    expect(inRange(cards, 7, 9)).toEqual([])
  })
})

describe('shuffle', () => {
  it('keeps every item exactly once and leaves the input alone', () => {
    const before = cards.slice()
    const out = shuffle(cards, seeded(1))
    expect(out.map((c) => c.id).sort()).toEqual(cards.map((c) => c.id).sort())
    expect(cards).toEqual(before)
  })
})

describe('startQueue', () => {
  it('caps a fixed length at the deck size with no repeats', () => {
    const q = startQueue(cards, 4, seeded(2))
    expect(q).toHaveLength(4)
    expect(new Set(q.map((c) => c.id)).size).toBe(4)
    expect(startQueue(cards, 50, seeded(2))).toHaveLength(cards.length)
  })
  it('uses the whole deck for "all" and "endless"', () => {
    expect(startQueue(cards, 'all')).toHaveLength(cards.length)
    expect(startQueue(cards, 'endless')).toHaveLength(cards.length)
  })
})

describe('refill', () => {
  it('never starts with the card just shown', () => {
    for (let seed = 0; seed < 200; seed++) {
      const deck = refill(cards, 'es:2:uno', seeded(seed))
      expect(deck[0].id).not.toBe('es:2:uno')
      expect(deck).toHaveLength(cards.length)
    }
  })
  it('handles a one-card range', () => {
    expect(refill(cards.slice(0, 1), 'es:1:hola')).toHaveLength(1)
  })
})

describe('plannedCount', () => {
  it('reports what the session will actually show', () => {
    expect(plannedCount(263, 20)).toBe(20)
    expect(plannedCount(12, 20)).toBe(12)
    expect(plannedCount(263, 'all')).toBe(263)
    expect(plannedCount(263, 'endless')).toBeNull()
  })
})

describe('promptIsForeign', () => {
  it('follows fixed directions and mixes otherwise', () => {
    expect(promptIsForeign('forward')).toBe(true)
    expect(promptIsForeign('reverse')).toBe(false)
    const rng = seeded(3)
    const sides = new Set(Array.from({ length: 20 }, () => promptIsForeign('mixed', rng)))
    expect(sides).toEqual(new Set([true, false]))
  })
})
