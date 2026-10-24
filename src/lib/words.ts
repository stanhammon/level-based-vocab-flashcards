import { useEffect, useState } from 'react'
import { toCards, type Card } from './deck'
import type { LanguageFile, LanguageInfo, Manifest } from './wordData'

export interface Language {
  info: LanguageInfo
  sections: Record<number, string>
  cards: Card[]
}

type Loadable<T> = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; data: T }

// Fetched once per page load and shared by every screen.
let manifestPromise: Promise<Manifest> | null = null
const languagePromises = new Map<string, Promise<Language>>()

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`)
  return (await res.json()) as T
}

export function getManifest(): Promise<Manifest> {
  manifestPromise ??= getJson<Manifest>('/data/languages.json').catch((e: unknown) => {
    manifestPromise = null
    throw e
  })
  return manifestPromise
}

export function getLanguage(info: LanguageInfo): Promise<Language> {
  let p = languagePromises.get(info.code)
  if (!p) {
    p = getJson<LanguageFile>(info.file)
      .then((file) => ({ info, sections: file.sections, cards: toCards(file) }))
      .catch((e: unknown) => {
        languagePromises.delete(info.code)
        throw e
      })
    languagePromises.set(info.code, p)
  }
  return p
}

function useLoad<T>(load: () => Promise<T>, key: string): Loadable<T> {
  const [state, setState] = useState<Loadable<T> & { key: string }>({ status: 'loading', key })
  useEffect(() => {
    let live = true
    load().then(
      (data) => live && setState({ status: 'ready', data, key }),
      (e: unknown) => live && setState({ status: 'error', error: e instanceof Error ? e.message : String(e), key }),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies `load`
  }, [key])
  return state.key === key ? state : { status: 'loading' }
}

export const useManifest = () => useLoad(getManifest, 'manifest')

/** The manifest plus one language's words, by language code. */
export function useLanguage(code: string | undefined): Loadable<Language> | { status: 'missing' } {
  const result = useLoad(async () => {
    const manifest = await getManifest()
    const info = manifest.languages.find((l) => l.code === code)
    return info ? getLanguage(info) : null
  }, `lang:${code}`)
  if (result.status === 'ready' && result.data === null) return { status: 'missing' }
  return result as Loadable<Language>
}
