/** Shapes of the JSON written by scripts/build-data.ts and served from /data. */

export interface LanguageInfo {
  /** Display name, e.g. "Spanish". */
  name: string
  /** Short code used in card IDs and storage keys, e.g. "es". */
  code: string
  /** Preferred speech-synthesis locales, best first; empty = no TTS. */
  tts: string[]
  /** True when built from the bundled sample list instead of a real one. */
  sample: boolean
  count: number
  minLevel: number
  maxLevel: number
  /** URL of the language's word file, with a content hash for cache busting. */
  file: string
}

export interface Manifest {
  languages: LanguageInfo[]
}

/** [word, short translation, full translation ('' when same as short), level] */
export type RawCard = [string, string, string, number]

export interface LanguageFile {
  code: string
  /** Level number → section title. */
  sections: Record<number, string>
  cards: RawCard[]
}
