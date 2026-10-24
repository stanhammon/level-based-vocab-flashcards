/**
 * Font sizes for card text. A long single word (German compounds such as
 * "Wohltätigkeitsorganisation") can't wrap at spaces, so size by the longest
 * word as well as the overall length; anything still too wide hyphenates.
 */

const longestWord = (text: string) => Math.max(0, ...text.split(/\s+/).map((w) => w.length))

/** The prompt on the card front (48px by default). */
export function frontSize(text: string): string {
  const w = longestWord(text)
  if (w > 18 || text.length > 40) return 'text-2xl'
  if (w > 14 || text.length > 28) return 'text-3xl'
  if (w > 11) return 'text-4xl'
  return 'text-5xl'
}

/** The answer on the card back (34px by default). */
export function answerSize(text: string): string {
  const w = longestWord(text)
  if (w > 18 || text.length > 60) return 'text-2xl'
  if (w > 14) return 'text-[28px]'
  return 'text-[34px]'
}

/** The prompt repeated at the top of the card back (26px by default). */
export function recapSize(text: string): string {
  return longestWord(text) > 18 ? 'text-xl' : 'text-[26px]'
}
