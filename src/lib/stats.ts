/**
 * Per-word, per-direction results (SPEC §6.2). `applyGrade` mirrors the SQL
 * in supabase/sql/001_flashcards.sql (fc_record_grades): keep them in step.
 */

/** forward = foreign word shown; reverse = English shown. */
export type StatDirection = 'forward' | 'reverse'

export interface Stat {
  seen: number
  correct: number
  missed: number
  streak: number
  /** Leitner box 0–5. */
  box: number
  /** Next review time (ms since epoch). */
  dueAt: number
  lastSeenAt: number
}

/** Leitner intervals per box, in days (SPEC §6.3). */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const
const DAY = 86_400_000

export const statKey = (cardId: string, direction: StatDirection) => `${cardId}|${direction}`

export function applyGrade(prev: Stat | undefined, got: boolean, at: number): Stat {
  const box = got ? Math.min((prev?.box ?? 0) + 1, 5) : 0
  return {
    seen: (prev?.seen ?? 0) + 1,
    correct: (prev?.correct ?? 0) + (got ? 1 : 0),
    missed: (prev?.missed ?? 0) + (got ? 0 : 1),
    streak: got ? (prev?.streak ?? 0) + 1 : 0,
    box,
    dueAt: at + BOX_DAYS[box] * DAY,
    lastSeenAt: Math.max(prev?.lastSeenAt ?? 0, at),
  }
}

export interface GradeEvent {
  cardId: string
  direction: StatDirection
  language: string
  got: boolean
  at: number
}
