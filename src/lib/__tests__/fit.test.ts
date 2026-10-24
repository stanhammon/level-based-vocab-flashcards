import { describe, expect, it } from 'vitest'
import { answerSize, frontSize, recapSize } from '../fit'

describe('card text sizes', () => {
  it('keeps short words large', () => {
    expect(frontSize('encantada')).toBe('text-5xl')
    expect(answerSize('nice to meet you')).toBe('text-[34px]')
    expect(recapSize('quieres')).toBe('text-[26px]')
  })
  it('shrinks for a long single word even when the text is short overall', () => {
    expect(frontSize('Wohltätigkeitsorganisation')).toBe('text-2xl')
    expect(frontSize('Geburtstagskuchen')).toBe('text-3xl')
    expect(frontSize('Toilettenpapier')).toBe('text-3xl')
    expect(frontSize('Weihnachtsmarkt')).toBe('text-3xl')
    expect(answerSize('Wohltätigkeitsorganisation')).toBe('text-2xl')
    expect(recapSize('Wohltätigkeitsorganisation')).toBe('text-xl')
  })
  it('shrinks for long phrases', () => {
    expect(frontSize('where do you originate from, where are you from')).toBe('text-2xl')
    expect(answerSize('where are you from, where do you come from, where do you originate from')).toBe('text-2xl')
  })
})
