/** Level range helpers for the setup screen (SPEC §6.1). */

export interface Range {
  min: number
  max: number
}

/** Set the From level; To moves up with it if needed, so From ≤ To. */
export function setFrom(r: Range, level: number, lo: number, hi: number): Range {
  const min = Math.min(hi, Math.max(lo, level))
  return { min, max: Math.max(r.max, min) }
}

/** Set the To level; From moves down with it if needed, so From ≤ To. */
export function setTo(r: Range, level: number, lo: number, hi: number): Range {
  const max = Math.min(hi, Math.max(lo, level))
  return { min: Math.min(r.min, max), max }
}

/** Lower-case and strip accents, so "cafe" finds "Café". */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Levels whose title contains every word of the query (any order, ignoring
 * case and accents). A number in the query also matches that level number.
 */
export function searchLevels(sections: Record<number, string>, query: string): { level: number; title: string }[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return Object.entries(sections)
    .map(([n, title]) => ({ level: Number(n), title }))
    .filter(({ level, title }) => {
      const t = fold(title)
      return words.every((w) => t.includes(w) || String(level) === w)
    })
    .sort((a, b) => a.level - b.level)
}
