import type { Direction } from './deck'

export const directionLabels = (code: string): Record<Direction, string> => {
  const c = code.toUpperCase()
  return { forward: `${c} → EN`, reverse: `EN → ${c}`, mixed: 'Mixed' }
}
