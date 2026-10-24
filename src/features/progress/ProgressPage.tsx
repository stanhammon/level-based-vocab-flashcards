import { btnAccent } from '@/components/styles'
import { Header, Page, SectionLabel, StarIcon, Status } from '@/components/ui'
import type { Card } from '@/lib/deck'
import { directionLabels } from '@/lib/labels'
import { useProgress, useStarred, type SessionRecord } from '@/lib/progressContext'
import { statKey, type Stat, type StatDirection } from '@/lib/stats'
import { errorMessage, supabase } from '@/lib/supabase'
import { useLanguage, type Language } from '@/lib/words'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { QuizState } from '../quiz/QuizPage'

const MOST_MISSED = 15
const SESSIONS_SHOWN = 30
const panel = 'flex flex-col rounded-[18px] bg-surface p-4 shadow-[0_1px_2px_rgba(22,33,58,0.08)]'

export function ProgressPage() {
  const { lang } = useParams()
  const language = useLanguage(lang)
  const { userId } = useProgress()
  if (language.status === 'loading') return <Status>Loading…</Status>
  if (language.status !== 'ready') {
    return <Status action={<Link to="/languages">Pick a language</Link>}>Couldn't load that language.</Status>
  }
  if (!userId) {
    return (
      <Status action={<Link to={`/account?from=/${language.data.info.code}/progress`}>Sign in</Link>}>
        Sign in to see your progress across devices.
      </Status>
    )
  }
  return <Progress key={userId} language={language.data} />
}

type Loaded = { stats: Map<string, Stat>; sessions: SessionRecord[] }

function Progress({ language }: { language: Language }) {
  const { info, cards } = language
  const navigate = useNavigate()
  const { loadStats, toggleStar, resetProgress } = useProgress()
  const starred = useStarred(info.code)
  const labels = directionLabels(info.code)
  const [data, setData] = useState<Loaded | { error: string } | null>(null)
  const [reload, setReload] = useState(0)
  const [direction, setDirection] = useState<StatDirection>('forward')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const stats = await loadStats(info.code)
        const { data: sessions, error } = await supabase
          .from('fc_sessions')
          .select('*')
          .eq('language', info.code)
          .order('ended_at', { ascending: false })
          .limit(SESSIONS_SHOWN)
        if (error) throw error
        if (live) setData({ stats, sessions: sessions as SessionRecord[] })
      } catch (e) {
        if (live) setData({ error: errorMessage(e) })
      }
    })()
    return () => {
      live = false
    }
  }, [loadStats, info.code, reload])

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  const totals = useMemo(() => {
    if (!data || 'error' in data) return null
    return (['forward', 'reverse'] as const).map((d) => {
      let words = 0
      let seen = 0
      let correct = 0
      for (const c of cards) {
        const s = data.stats.get(statKey(c.id, d))
        if (!s) continue
        words++
        seen += s.seen
        correct += s.correct
      }
      return { d, words, seen, pct: seen ? Math.round((correct / seen) * 100) : null }
    })
  }, [data, cards])

  const mostMissed = useMemo(() => {
    if (!data || 'error' in data) return []
    const rows: { card: Card; s: Stat }[] = []
    for (const c of cards) {
      const s = data.stats.get(statKey(c.id, direction))
      if (s && s.missed > 0) rows.push({ card: c, s })
    }
    return rows
      .sort((a, b) => b.s.missed - a.s.missed || a.s.correct / a.s.seen - b.s.correct / b.s.seen)
      .slice(0, MOST_MISSED)
  }, [data, cards, direction])

  const starredCards = useMemo(
    () => [...starred].map((id) => byId.get(id)).filter((c): c is Card => !!c).sort((a, b) => a.level - b.level),
    [starred, byId],
  )

  const drill = (ids: string[], dir?: StatDirection) => {
    const state: QuizState = { start: Date.now(), drill: ids }
    // A drill follows the saved direction setting; most-missed drills use the direction shown.
    if (dir) state.direction = dir
    navigate(`/${info.code}/quiz`, { state })
  }

  if (data === null) return <Status>Loading your progress…</Status>
  if ('error' in data) {
    return <Status action={<button type="button" className="font-bold underline" onClick={() => setReload((r) => r + 1)}>Try again</button>}>{data.error}</Status>
  }

  return (
    <Page>
      <Header languageName={info.name} />
      <main className="flex flex-col gap-4 px-5 pt-1 pb-8">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="m-0 font-display text-[30px] leading-tight font-extrabold tracking-tight">Your progress</h1>
          <Link to={`/${info.code}`} className="shrink-0 text-[15px] font-bold text-ink">
            New session
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {totals?.map((t) => (
            <section key={t.d} className={`${panel} gap-1`}>
              <SectionLabel>{labels[t.d]}</SectionLabel>
              <span className="font-display text-[32px] leading-none font-extrabold">{t.pct === null ? '—' : `${t.pct}%`}</span>
              <span className="text-sm text-muted">
                {t.words.toLocaleString()} words practiced
                <br />
                {t.seen.toLocaleString()} cards graded
              </span>
            </section>
          ))}
        </div>

        <section className={panel}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionLabel>Most missed</SectionLabel>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-track p-1" role="group" aria-label="Direction">
              {(['forward', 'reverse'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={direction === d}
                  onClick={() => setDirection(d)}
                  className={`h-9 rounded-[9px] px-2.5 text-sm font-bold ${direction === d ? 'bg-primary text-primary-ink' : 'text-ink'}`}
                >
                  {labels[d]}
                </button>
              ))}
            </div>
          </div>
          {mostMissed.length === 0 ? (
            <p className="m-0 py-2 text-muted">No missed words in this direction yet.</p>
          ) : (
            <>
              <ul className="m-0 list-none p-0">
                {mostMissed.map(({ card, s }, i) => (
                  <li key={card.id} className={`flex items-center gap-3 py-2.5 ${i < mostMissed.length - 1 ? 'border-b border-track' : ''}`}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span lang={info.code} className="font-display text-lg font-bold break-words">
                        {card.word}
                      </span>
                      <span className="text-sm text-muted">
                        {card.short} · L{card.level}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm text-muted">
                      missed <strong className="text-miss-ink">{s.missed}</strong> of {s.seen}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`${btnAccent} mt-3`}
                onClick={() => drill(mostMissed.map((r) => r.card.id), direction)}
              >
                Drill these {mostMissed.length} ({labels[direction]})
              </button>
            </>
          )}
        </section>

        <section className={panel}>
          <SectionLabel>Recent sessions</SectionLabel>
          {data.sessions.length === 0 ? (
            <p className="m-0 py-2 text-muted">Finished sessions will show up here.</p>
          ) : (
            <ul className="m-0 mt-1 list-none p-0">
              {data.sessions.map((r, i) => {
                const pct = r.shown ? Math.round((r.correct / r.shown) * 100) : 0
                return (
                  <li key={r.id} className={`flex items-center gap-3 py-2.5 ${i < data.sessions.length - 1 ? 'border-b border-track' : ''}`}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-bold">
                        {new Date(r.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                        {r.selection === 'drill' ? 'Drill' : `Levels ${r.min_level}–${r.max_level}`}
                      </span>
                      <span className="text-sm text-muted">
                        {labels[r.direction as keyof typeof labels] ?? r.direction} · {r.correct}/{r.shown}
                      </span>
                    </span>
                    {/* Inline bar: accuracy at a glance down the list. */}
                    <span className="flex w-24 shrink-0 items-center gap-2" aria-label={`${pct}% correct`}>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                        <span className="block h-full rounded-full bg-good" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-9 text-right text-sm font-bold">{pct}%</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={panel}>
          <SectionLabel>Starred words</SectionLabel>
          {starredCards.length === 0 ? (
            <p className="m-0 py-2 text-muted">Tap the star on a card to save a word here.</p>
          ) : (
            <>
              <ul className="m-0 mt-1 list-none p-0">
                {starredCards.map((card, i) => (
                  <li key={card.id} className={`flex items-center gap-3 py-2 ${i < starredCards.length - 1 ? 'border-b border-track' : ''}`}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span lang={info.code} className="font-display text-lg font-bold break-words">
                        {card.word}
                      </span>
                      <span className="text-sm text-muted">
                        {card.short} · L{card.level}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleStar(info.code, card.id)}
                      aria-label={`Unstar ${card.word}`}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-chip text-ink"
                    >
                      <StarIcon filled size={20} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${btnAccent} mt-3`} onClick={() => drill(starredCards.map((c) => c.id))}>
                Drill starred words
              </button>
            </>
          )}
        </section>

        <section className={`${panel} gap-2`}>
          <SectionLabel>Start over</SectionLabel>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="h-11 self-start rounded-xl border-2 border-miss px-4 font-bold text-miss-ink"
            >
              Reset {info.name} progress…
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="m-0 text-sm">
                This permanently deletes your {info.name} results and session history in both directions. Starred words
                stay.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await resetProgress(info.code)
                      setConfirmReset(false)
                      setData(null)
                      setReload((r) => r + 1)
                    } catch (e) {
                      setData({ error: errorMessage(e) })
                    }
                  }}
                  className="h-11 rounded-xl border-2 border-miss bg-miss px-4 font-bold text-white dark:text-bg"
                >
                  Delete progress
                </button>
                <button type="button" onClick={() => setConfirmReset(false)} className="h-11 rounded-xl border-2 border-line px-4 font-bold">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </Page>
  )
}
