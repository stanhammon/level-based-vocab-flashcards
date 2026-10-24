import { describe, expect, it } from 'vitest'
import { findVoice } from '../speech'

const v = (lang: string, localService = true, name = lang) => ({ lang, localService, name }) as SpeechSynthesisVoice
const ES = ['es-MX', 'es-US', 'es']

describe('findVoice', () => {
  it('takes locales in order of preference', () => {
    expect(findVoice([v('es-ES'), v('es-US'), v('es-MX')], ES)?.lang).toBe('es-MX')
    expect(findVoice([v('es-ES'), v('es-US')], ES)?.lang).toBe('es-US')
  })
  it('falls back to any voice of the language', () => {
    expect(findVoice([v('en-US'), v('es-ES')], ES)?.lang).toBe('es-ES')
  })
  it('returns null rather than another language', () => {
    expect(findVoice([v('en-US'), v('pt-BR')], ES)).toBeNull()
    expect(findVoice([v('en-US')], [])).toBeNull()
  })
  it('accepts Android-style tags and prefers on-device voices', () => {
    expect(findVoice([v('es_MX', false, 'net'), v('es_MX', true, 'local')], ES)?.name).toBe('local')
  })
  it('offline, skips voices that need a connection', () => {
    expect(findVoice([v('es-US', false)], ES, true)).toBeNull()
    expect(findVoice([v('es-US', false), v('es-ES', true)], ES, true)?.lang).toBe('es-ES')
  })
  it('does not treat "es" as a prefix of other languages', () => {
    expect(findVoice([v('est-EE')], ['es'])).toBeNull()
  })
})
