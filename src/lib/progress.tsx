import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './authContext'
import { ProgressContext, type ProgressApi, type SessionRecord } from './progressContext'
import { saveLastLanguage, saveSettings, type SessionSettings } from './settings'
import { applyGrade, statKey, type GradeEvent, type Stat, type StatDirection } from './stats'
import { load, loadAll, remove, save } from './storage'
import { supabase } from './supabase'

/**
 * Where progress lives (SPEC §4): on the device when signed out, in the
 * account when signed in. Device progress is never uploaded on sign-in.
 *
 * Account writes go through a queue saved on the device: grades are sent in
 * batches every few seconds, and each batch keeps its ID across retries so the
 * server applies it once (fc_record_grades).
 */

type Pending =
  | { kind: 'grades'; batchId: string; events: GradeEvent[] }
  | { kind: 'session'; row: SessionRecord }

const FLUSH_MS = 4000
/** Account stats are refetched after this long, to pick up other devices. */
const STATS_TTL_MS = 120_000
const BATCH_MAX = 200
const PAGE = 1000

const localStatsKey = (lang: string) => `stats:${lang}`
// Offline copies of account data (SPEC §8), removed on sign-out.
const acctStatsKey = (uid: string, lang: string) => `acct:stats:${uid}:${lang}`
const acctStarredKey = (uid: string, lang: string) => `acct:starred:${uid}:${lang}`
const pendingKey = (uid: string) => `pending:${uid}`

function recordLocally(events: GradeEvent[]) {
  const byLang = new Map<string, GradeEvent[]>()
  for (const e of events) byLang.set(e.language, [...(byLang.get(e.language) ?? []), e])
  for (const [lang, evs] of byLang) {
    const stats = load<Record<string, Stat>>(localStatsKey(lang), {})
    for (const e of evs) {
      const k = statKey(e.cardId, e.direction)
      stats[k] = applyGrade(stats[k], e.got, e.at)
    }
    save(localStatsKey(lang), stats)
  }
}

interface StatRow {
  card_id: string
  direction: StatDirection
  seen: number
  correct: number
  missed: number
  streak: number
  box: number
  due_at: string | null
  last_seen_at: string | null
}

/** Every per-word stat row for one language in the signed-in account (paged). */
async function fetchAccountStats(language: string): Promise<Map<string, Stat>> {
  const out = new Map<string, Stat>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('fc_word_stats')
      .select('card_id, direction, seen, correct, missed, streak, box, due_at, last_seen_at')
      .eq('language', language)
      .order('card_id')
      .order('direction')
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of data as StatRow[]) {
      out.set(statKey(r.card_id, r.direction), {
        seen: r.seen,
        correct: r.correct,
        missed: r.missed,
        streak: r.streak,
        box: r.box,
        dueAt: r.due_at ? Date.parse(r.due_at) : 0,
        lastSeenAt: r.last_seen_at ? Date.parse(r.last_seen_at) : 0,
      })
    }
    if (data.length < PAGE) break
  }
  return out
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [settingsVersion, setSettingsVersion] = useState(0)
  // Keyed by user so another account's data never shows after switching.
  const [starredState, setStarredState] = useState<{ uid: string | null; byLang: Record<string, Set<string>> }>({
    uid: null,
    byLang: {},
  })
  const starred = useMemo(
    () => (starredState.uid === userId ? starredState.byLang : {}),
    [starredState, userId],
  )
  const [pending, setPending] = useState<{ uid: string | null; count: number }>({ uid: null, count: 0 })
  const pendingCount = pending.uid === userId ? pending.count : 0
  const prefs = useRef<{ last: string | null; byLang: Record<string, SessionSettings> }>({ last: null, byLang: {} })
  const settingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Uploading settings before the account's copy has loaded would overwrite it.
  const settingsLoaded = useRef(false)
  const flushing = useRef(false)
  // Account stats per language, kept current with this device's grades.
  const statsCache = useRef<{ uid: string | null; byLang: Map<string, { at: number; stats: Map<string, Stat> }> }>({
    uid: null,
    byLang: new Map(),
  })

  // ---- upload queue ----------------------------------------------------------
  const readQueue = useCallback((uid: string) => load<Pending[]>(pendingKey(uid), []), [])
  const writeQueue = useCallback((uid: string, q: Pending[]) => {
    save(pendingKey(uid), q)
    setPending({ uid, count: q.reduce((n, p) => n + (p.kind === 'grades' ? p.events.length : 0), 0) })
  }, [])

  const flush = useCallback(async () => {
    if (!userId || flushing.current) return
    flushing.current = true
    try {
      for (;;) {
        const queue = readQueue(userId)
        const head = queue[0]
        if (!head) break
        if (head.kind === 'grades') {
          const { error } = await supabase.rpc('fc_record_grades', {
            p_batch: head.batchId,
            p_grades: head.events.map((e) => ({
              card_id: e.cardId,
              direction: e.direction,
              language: e.language,
              got: e.got,
              at: new Date(e.at).toISOString(),
            })),
          })
          if (error) break
        } else {
          const { error } = await supabase
            .from('fc_sessions')
            .upsert({ ...head.row, user_id: userId }, { onConflict: 'id', ignoreDuplicates: true })
          if (error) break
        }
        // Re-read: grades may have been queued while the request was in flight.
        writeQueue(userId, readQueue(userId).slice(1))
      }
    } finally {
      flushing.current = false
    }
  }, [userId, readQueue, writeQueue])

  const enqueue = useCallback(
    (item: Pending) => {
      if (!userId) return
      const q = readQueue(userId)
      const last = q[q.length - 1]
      // Grow the newest grades batch only if it has never been sent, so a
      // batch ID always names the same grades.
      if (item.kind === 'grades' && last?.kind === 'grades' && q.length > 1 && last.events.length < BATCH_MAX) {
        last.events.push(...item.events)
      } else q.push(item)
      writeQueue(userId, q)
    },
    [userId, readQueue, writeQueue],
  )

  useEffect(() => {
    if (!userId) return
    // Show the count of grades left in this device's upload queue (external storage).
    // oxlint-disable-next-line react/set-state-in-effect
    writeQueue(userId, readQueue(userId))
    void flush()
    const timer = setInterval(() => void flush(), FLUSH_MS)
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      void flush()
      // Keep the offline copy of results current with this session's grades.
      if (statsCache.current.uid === userId) {
        for (const [lang, { stats }] of statsCache.current.byLang) save(acctStatsKey(userId, lang), Object.fromEntries(stats))
      }
    }
    const onOnline = () => void flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
    }
  }, [userId, flush, readQueue, writeQueue])

  const record = useCallback(
    (events: GradeEvent[]) => {
      if (events.length === 0) return
      if (!userId) return recordLocally(events)
      if (statsCache.current.uid === userId) {
        for (const e of events) {
          const stats = statsCache.current.byLang.get(e.language)?.stats
          const k = statKey(e.cardId, e.direction)
          if (stats) stats.set(k, applyGrade(stats.get(k), e.got, e.at))
        }
      }
      enqueue({ kind: 'grades', batchId: crypto.randomUUID(), events })
    },
    [userId, enqueue],
  )

  const saveSession = useCallback(
    (row: SessionRecord) => {
      if (!userId) return
      enqueue({ kind: 'session', row })
      void flush()
    },
    [userId, enqueue, flush],
  )

  // ---- settings sync -----------------------------------------------------------
  useEffect(() => {
    settingsLoaded.current = false
    if (!userId) return
    let live = true
    void (async () => {
      const { data, error } = await supabase.from('fc_settings').select('last_language, prefs').maybeSingle()
      if (!live || error) return
      settingsLoaded.current = true
      if (data) {
        const byLang = (data.prefs ?? {}) as Record<string, SessionSettings>
        for (const [code, s] of Object.entries(byLang)) saveSettings(code, s)
        if (data.last_language) saveLastLanguage(data.last_language as string)
        prefs.current = { last: data.last_language as string | null, byLang }
        setSettingsVersion((v) => v + 1)
      } else {
        // First sign-in here: start the account from this device's settings.
        const byLang = loadAll<SessionSettings>('settings:')
        const last = load<string | null>('lastLanguage', null)
        prefs.current = { last, byLang }
        await supabase.from('fc_settings').upsert({ user_id: userId, last_language: last, prefs: byLang })
      }
    })()
    return () => {
      live = false
    }
  }, [userId])

  const pushSettings = useCallback(
    (code: string, s: SessionSettings) => {
      if (!userId || !settingsLoaded.current) return
      prefs.current = { last: code, byLang: { ...prefs.current.byLang, [code]: s } }
      if (settingsTimer.current) clearTimeout(settingsTimer.current)
      settingsTimer.current = setTimeout(() => {
        const { last, byLang } = prefs.current
        void supabase
          .from('fc_settings')
          .upsert({ user_id: userId, last_language: last, prefs: byLang, updated_at: new Date().toISOString() })
      }, 1500)
    },
    [userId],
  )

  // ---- stats --------------------------------------------------------------------
  const loadStats = useCallback(
    async (language: string): Promise<Map<string, Stat>> => {
      if (!userId) return new Map(Object.entries(load<Record<string, Stat>>(localStatsKey(language), {})))
      if (statsCache.current.uid !== userId) statsCache.current = { uid: userId, byLang: new Map() }
      const cached = statsCache.current.byLang.get(language)
      if (cached && Date.now() - cached.at < STATS_TTL_MS) return new Map(cached.stats)
      await flush()
      let out: Map<string, Stat>
      try {
        out = await fetchAccountStats(language)
      } catch (e) {
        // Offline: last saved copy plus grades still waiting to upload.
        const saved = load<Record<string, Stat> | null>(acctStatsKey(userId, language), null)
        if (!saved) throw e
        out = new Map(Object.entries(saved))
        for (const p of readQueue(userId)) {
          if (p.kind !== 'grades') continue
          for (const g of p.events) {
            if (g.language !== language) continue
            const k = statKey(g.cardId, g.direction)
            out.set(k, applyGrade(out.get(k), g.got, g.at))
          }
        }
        return out
      }
      save(acctStatsKey(userId, language), Object.fromEntries(out))
      if (statsCache.current.uid === userId) statsCache.current.byLang.set(language, { at: Date.now(), stats: out })
      return new Map(out)
    },
    [userId, flush, readQueue],
  )


  // ---- starred ------------------------------------------------------------------
  const loadingStars = useRef<{ uid: string | null; langs: Set<string> }>({ uid: null, langs: new Set() })

  const loadStarred = useCallback(
    (language: string) => {
      if (!userId) return
      if (loadingStars.current.uid !== userId) loadingStars.current = { uid: userId, langs: new Set() }
      const loading = loadingStars.current.langs
      if (loading.has(language)) return
      loading.add(language)
      const setFor = (ids: Set<string>) =>
        setStarredState((s) => ({ uid: userId, byLang: { ...(s.uid === userId ? s.byLang : {}), [language]: ids } }))
      // Show the offline copy straight away; the fetch below replaces it.
      const saved = load<string[] | null>(acctStarredKey(userId, language), null)
      if (saved) setFor(new Set(saved))
      void supabase
        .from('fc_starred')
        .select('card_id')
        .eq('language', language)
        .then(({ data, error }) => {
          if (error) {
            // Offline with an offline copy: keep it. Otherwise retry next time.
            if (!saved) loading.delete(language)
            return
          }
          const ids = data.map((r) => r.card_id as string)
          save(acctStarredKey(userId, language), ids)
          setFor(new Set(ids))
        })
    },
    [userId],
  )

  const toggleStar = useCallback(
    (language: string, cardId: string) => {
      if (!userId) return
      const was = starred[language]?.has(cardId) ?? false
      const apply = (on: boolean) =>
        setStarredState((s) => {
          const byLang = s.uid === userId ? s.byLang : {}
          const next = new Set(byLang[language] ?? [])
          if (on) next.add(cardId)
          else next.delete(cardId)
          save(acctStarredKey(userId, language), [...next])
          return { uid: userId, byLang: { ...byLang, [language]: next } }
        })
      apply(!was)
      const req = was
        ? supabase.from('fc_starred').delete().eq('card_id', cardId)
        : supabase.from('fc_starred').upsert({ user_id: userId, card_id: cardId, language })
      void req.then(({ error }) => error && apply(was))
    },
    [userId, starred],
  )

  // ---- reset --------------------------------------------------------------------
  const resetProgress = useCallback(
    async (language: string) => {
      if (!userId) {
        remove(localStatsKey(language))
        return
      }
      await flush()
      statsCache.current.byLang.delete(language)
      const a = await supabase.from('fc_word_stats').delete().eq('language', language)
      if (a.error) throw a.error
      const b = await supabase.from('fc_sessions').delete().eq('language', language)
      if (b.error) throw b.error
    },
    [userId, flush],
  )

  const api = useMemo<ProgressApi>(
    () => ({
      userId,
      settingsVersion,
      record,
      saveSession,
      pushSettings,
      loadStats,
      starred,
      loadStarred,
      toggleStar,
      resetProgress,
      pendingCount,
    }),
    [userId, settingsVersion, record, saveSession, pushSettings, loadStats, starred, loadStarred, toggleStar, resetProgress, pendingCount],
  )
  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>
}
