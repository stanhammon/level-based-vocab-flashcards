import { beforeEach, describe, expect, it } from 'vitest'
import { loadSettings, mergeSettings, saveSettings, type SessionSettings } from '../settings'
import type { LanguageInfo } from '../wordData'

const es: LanguageInfo = { name: 'Spanish', code: 'es', tts: [], sample: false, count: 7158, minLevel: 1, maxLevel: 303, file: '' }
const s = (min: number, max: number, updatedAt: number): Partial<SessionSettings> => ({
  min,
  max,
  direction: 'forward',
  selection: 'shuffled',
  length: 20,
  starredOnly: false,
  updatedAt,
})

describe('mergeSettings', () => {
  it('keeps newer levels set on this device over an older account copy (the lost-levels bug)', () => {
    const { merged, fromAccount, upload } = mergeSettings({ es: s(1, 10, 1000) }, { es: s(40, 60, 2000) })
    expect(merged.es).toMatchObject({ min: 40, max: 60 })
    expect(fromAccount).toEqual([])
    expect(upload).toBe(true)
  })

  it('takes newer levels set on another device', () => {
    const { merged, fromAccount, upload } = mergeSettings({ es: s(40, 60, 3000) }, { es: s(1, 10, 2000) })
    expect(merged.es).toMatchObject({ min: 40, max: 60 })
    expect(fromAccount).toEqual(['es'])
    expect(upload).toBe(false)
  })

  it('decides each language separately', () => {
    const { merged, fromAccount } = mergeSettings(
      { es: s(5, 6, 3000), de: s(1, 2, 1000) },
      { es: s(7, 8, 2000), de: s(9, 9, 2000) },
    )
    expect(merged.es).toMatchObject({ min: 5, max: 6 })
    expect(merged.de).toMatchObject({ min: 9, max: 9 })
    expect(fromAccount).toEqual(['es'])
  })

  it('treats copies saved before change times existed as oldest, preferring this device', () => {
    const legacy = { ...s(1, 10, 0), updatedAt: undefined }
    const { merged, upload } = mergeSettings({ es: legacy }, { es: { ...s(30, 40, 0), updatedAt: undefined } })
    expect(merged.es).toMatchObject({ min: 30, max: 40 })
    expect(upload).toBe(true)
  })

  it('uploads languages the account has never seen and needs nothing when equal', () => {
    expect(mergeSettings({}, { de: s(3, 4, 5) }).upload).toBe(true)
    expect(mergeSettings({ es: s(3, 4, 5) }, { es: s(3, 4, 5) }).upload).toBe(false)
  })
})

describe('loadSettings / saveSettings', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    } as Storage
  })

  it('keeps saved levels across loads', () => {
    saveSettings('es', { ...loadSettings(es), min: 120, max: 135, updatedAt: 42 })
    expect(loadSettings(es)).toMatchObject({ min: 120, max: 135, updatedAt: 42 })
  })

  it('defaults the change time for settings saved by older versions', () => {
    localStorage.setItem('lvf:settings:es', JSON.stringify({ min: 7, max: 9 }))
    expect(loadSettings(es)).toMatchObject({ min: 7, max: 9, updatedAt: 0 })
  })
})
