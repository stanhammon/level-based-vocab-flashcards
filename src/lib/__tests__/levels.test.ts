import { describe, expect, it } from 'vitest'
import { searchLevels, setFrom, setTo } from '../levels'

describe('setFrom / setTo', () => {
  it('step within bounds', () => {
    expect(setFrom({ min: 5, max: 10 }, 6, 1, 303)).toEqual({ min: 6, max: 10 })
    expect(setTo({ min: 5, max: 10 }, 9, 1, 303)).toEqual({ min: 5, max: 9 })
  })
  it('clamp to the language’s levels', () => {
    expect(setFrom({ min: 1, max: 10 }, 0, 1, 303)).toEqual({ min: 1, max: 10 })
    expect(setTo({ min: 1, max: 303 }, 304, 1, 303)).toEqual({ min: 1, max: 303 })
  })
  it('push the other end along instead of crossing it', () => {
    expect(setFrom({ min: 5, max: 5 }, 6, 1, 303)).toEqual({ min: 6, max: 6 })
    expect(setTo({ min: 5, max: 5 }, 4, 1, 303)).toEqual({ min: 4, max: 4 })
    expect(setFrom({ min: 1, max: 10 }, 150, 1, 303)).toEqual({ min: 150, max: 150 })
  })
})

describe('searchLevels', () => {
  const sections = {
    1: 'Order at a café',
    2: 'Greet people and say goodbye',
    12: 'Interests: Talk about hobbies',
    150: 'Chores: Describe household chores',
    152: 'Neighborhood: Describe favorite local spots',
  }
  it('matches part of a title, ignoring case and accents', () => {
    expect(searchLevels(sections, 'CAFE').map((r) => r.level)).toEqual([1])
    expect(searchLevels(sections, 'describe').map((r) => r.level)).toEqual([150, 152])
  })
  it('needs every word, in any order', () => {
    expect(searchLevels(sections, 'spots describe').map((r) => r.level)).toEqual([152])
    expect(searchLevels(sections, 'describe hobbies')).toEqual([])
  })
  it('matches a level number', () => {
    expect(searchLevels(sections, '12').map((r) => r.level)).toEqual([12])
  })
  it('returns nothing for an empty query', () => {
    expect(searchLevels(sections, '   ')).toEqual([])
  })
})
