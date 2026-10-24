import { createContext, useContext, useEffect } from 'react'
import type { SessionSettings } from './settings'
import type { GradeEvent, Stat } from './stats'

export interface SessionRecord {
  id: string
  language: string
  min_level: number
  max_level: number
  direction: string
  selection: string
  planned_length: number | null
  shown: number
  correct: number
  missed: number
  started_at: string
  ended_at: string
}

export interface ProgressApi {
  /** Signed-in user, or null when progress stays on this device. */
  userId: string | null
  /** Bumped when settings arrive from the account, so screens reload them. */
  settingsVersion: number
  record: (events: GradeEvent[]) => void
  saveSession: (row: SessionRecord) => void
  pushSettings: (code: string, s: SessionSettings) => void
  /** All per-word stats for a language, keyed by statKey(). */
  loadStats: (language: string) => Promise<Map<string, Stat>>
  starred: Record<string, Set<string>>
  loadStarred: (language: string) => void
  toggleStar: (language: string, cardId: string) => void
  resetProgress: (language: string) => Promise<void>
  /** Grades waiting to upload. */
  pendingCount: number
}

export const ProgressContext = createContext<ProgressApi | null>(null)

export function useProgress() {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider')
  return ctx
}

/** Starred card IDs for a language (empty when signed out). */
export function useStarred(language: string): Set<string> {
  const { starred, loadStarred, userId } = useProgress()
  useEffect(() => {
    if (userId) loadStarred(language)
  }, [userId, language, loadStarred])
  return (userId && starred[language]) || EMPTY
}
const EMPTY = new Set<string>()
