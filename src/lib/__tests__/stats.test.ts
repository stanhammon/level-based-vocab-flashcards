import { describe, expect, it } from 'vitest'
import { applyGrade, BOX_DAYS, statKey } from '../stats'

const DAY = 86_400_000
const t0 = Date.UTC(2026, 9, 24)

describe('applyGrade', () => {
  it('starts a new word in box 1 on Got it, due tomorrow', () => {
    const s = applyGrade(undefined, true, t0)
    expect(s).toEqual({ seen: 1, correct: 1, missed: 0, streak: 1, box: 1, dueAt: t0 + DAY, lastSeenAt: t0 })
  })

  it('starts a new word in box 0 on Missed, due now', () => {
    const s = applyGrade(undefined, false, t0)
    expect(s).toMatchObject({ seen: 1, correct: 0, missed: 1, streak: 0, box: 0, dueAt: t0 })
  })

  it('climbs one box per Got it, capped at 5, with the Leitner intervals', () => {
    let s = applyGrade(undefined, true, t0)
    for (let i = 2; i <= 7; i++) s = applyGrade(s, true, t0)
    expect(s.box).toBe(5)
    expect(s.streak).toBe(7)
    expect(s.dueAt).toBe(t0 + BOX_DAYS[5] * DAY)
  })

  it('drops to box 0 and resets the streak on Missed', () => {
    let s = applyGrade(undefined, true, t0)
    s = applyGrade(s, true, t0)
    s = applyGrade(s, false, t0 + 5)
    expect(s).toMatchObject({ seen: 3, correct: 2, missed: 1, streak: 0, box: 0, dueAt: t0 + 5, lastSeenAt: t0 + 5 })
  })
})

describe('statKey', () => {
  it('keeps directions apart', () => {
    expect(statKey('es:3:encantada', 'forward')).not.toBe(statKey('es:3:encantada', 'reverse'))
  })
})
