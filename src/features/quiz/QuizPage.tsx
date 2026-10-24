import { CheckIcon, CloseIcon, LevelTag, MissIcon, SpeakerIcon, StarIcon, Status, UndoIcon } from '@/components/ui'
import { inRange, plannedCount, promptIsForeign, refill, startQueue, type Card, type SessionLength } from '@/lib/deck'
import { useProgress, useStarred } from '@/lib/progressContext'
import {
  MAX_RETRIES,
  pickRandom,
  pickWeighted,
  planSrs,
  retryPosition,
  type Selection,
  type Shown,
} from '@/lib/selection'
import { loadSettings, type SessionSettings } from '@/lib/settings'
import { answerSize, frontSize, recapSize } from '@/lib/fit'
import { speak, useVoice } from '@/lib/speech'
import { applyGrade, statKey, type GradeEvent, type Stat, type StatDirection } from '@/lib/stats'
import { useLanguage, type Language } from '@/lib/words'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Summary } from './Summary'

/** Router state for `/:lang/quiz`. `drill` restricts the session to those card IDs. */
export interface QuizState {
  start: number
  drill?: string[]
  /** Quiz in this direction instead of the saved setting (most-missed drills). */
  direction?: StatDirection
  /** Use this card order instead of the saved setting ("shuffled instead" when nothing is due). */
  selection?: Selection
}

/** Modes that need the saved per-word stats before the first card. */
const needsStats = (s: Selection) => s === 'weighted' || s === 'srs'

export function QuizPage() {
  const { lang } = useParams()
  const location = useLocation()
  const language = useLanguage(lang)
  const { userId, starred, loadStarred, loadStats } = useProgress()
  const state = location.state as QuizState | null
  const info = language.status === 'ready' ? language.data.info : null
  const settings = info ? loadSettings(info) : null
  // A starred-only session can't start until the stars have loaded.
  const needStars = !!settings && userId !== null && settings.starredOnly && !state?.drill
  const selection: Selection = state?.drill ? 'shuffled' : (state?.selection ?? settings?.selection ?? 'shuffled')
  const code = info?.code

  useEffect(() => {
    if (needStars && code) loadStarred(code)
  }, [needStars, code, loadStarred])

  const [loaded, setLoaded] = useState<{ key: string; stats: Map<string, Stat> | null } | null>(null)
  const wantStats = code !== undefined && needsStats(selection)
  useEffect(() => {
    if (!wantStats || !code) return
    let live = true
    loadStats(code).then(
      (stats) => live && setLoaded({ key: location.key, stats }),
      () => live && setLoaded({ key: location.key, stats: null }),
    )
    return () => {
      live = false
    }
  }, [wantStats, code, loadStats, location.key])

  if (language.status === 'loading') return <Status>Loading words…</Status>
  if (language.status !== 'ready') {
    return <Status action={<Link to="/languages">Pick a language</Link>}>Couldn't load that language.</Status>
  }
  if (needStars && !starred[language.data.info.code]) return <Status>Loading starred words…</Status>
  const ready = wantStats ? (loaded?.key === location.key ? loaded : null) : { stats: NO_STATS }
  if (!ready) return <Status>Loading your results…</Status>
  if (!ready.stats) {
    return (
      <Status action={<Link to={`/${language.data.info.code}`}>Back</Link>}>
        Couldn't load your results, which this card order needs. Check your connection and try again.
      </Status>
    )
  }
  // A new key (from Start, Again or Drill) starts a fresh session.
  return <Quiz key={location.key} language={language.data} state={state} selection={selection} stats={ready.stats} />
}

const NO_STATS = new Map<string, Stat>()

export interface Graded extends Shown {
  got: boolean
  at: number
}

const toEvent = (language: string, r: Graded): GradeEvent => ({
  cardId: r.card.id,
  direction: r.foreign ? 'forward' : 'reverse',
  language,
  got: r.got,
  at: r.at,
})

const sameShown = (a: Shown, b: Shown) => a.card.id === b.card.id && a.foreign === b.foreign

function Quiz({
  language,
  state,
  selection,
  stats,
}: {
  language: Language
  state: QuizState | null
  selection: Selection
  stats: Map<string, Stat>
}) {
  const navigate = useNavigate()
  const { info } = language
  const { userId, record, saveSession, toggleStar } = useProgress()
  const starred = useStarred(info.code)
  const voice = useVoice(info.tts)

  const [session] = useState(() => {
    const saved: SessionSettings = loadSettings(info)
    const settings = { ...saved, selection, ...(state?.direction ? { direction: state.direction } : {}) }
    const drill = state?.drill ? new Set(state.drill) : null
    let pool = drill ? language.cards.filter((c) => drill.has(c.id)) : inRange(language.cards, settings.min, settings.max)
    if (!drill && settings.starredOnly && userId) pool = pool.filter((c) => starred.has(c.id))
    const length: SessionLength = drill ? 'all' : settings.length
    return { settings, pool, length, drill: drill !== null, id: crypto.randomUUID(), startedAt: new Date() }
  })
  const { direction } = session.settings
  const shuffledShown = useCallback(
    (cards: Card[]): Shown[] => cards.map((card) => ({ card, foreign: promptIsForeign(direction) })),
    [direction],
  )

  /** Stats as of now: saved ones plus this session's grades so far. */
  const liveStats = useCallback(
    (graded: Graded[]) => {
      const live = new Map(stats)
      for (const r of graded) {
        const k = statKey(r.card.id, r.foreign ? 'forward' : 'reverse')
        live.set(k, applyGrade(live.get(k), r.got, r.at))
      }
      return live
    },
    [stats],
  )

  const pick = useCallback(
    (graded: Graded[]): Shown => {
      const lastId = graded[graded.length - 1]?.card.id
      return selection === 'weighted'
        ? pickWeighted(session.pool, direction, liveStats(graded), lastId, Math.random)
        : pickRandom(session.pool, direction, lastId, Math.random)
    },
    [selection, session.pool, direction, liveStats],
  )

  const [queue, setQueue] = useState<Shown[]>(() => {
    const { pool, length } = session
    if (pool.length === 0) return []
    if (selection === 'random' || selection === 'weighted') return [pick([])]
    if (selection === 'srs') {
      const { due, fresh } = planSrs(pool, direction, stats, Date.now(), Math.random)
      const plan = [...due, ...fresh]
      return typeof length === 'number' ? plan.slice(0, length) : plan
    }
    return shuffledShown(startQueue(pool, length))
  })
  // The queue before the last grade, so Undo also takes back a re-queued miss.
  const [queueBefore, setQueueBefore] = useState<Shown[] | null>(null)
  const [results, setResults] = useState<Graded[]>([])
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(false)

  // Grades are saved one step behind, so the single-level Undo never has to
  // reverse a saved result. Whatever is left is saved when the session ends.
  const [savedCount, setSavedCount] = useState(0)
  const saveGrades = useCallback(
    (list: Graded[], from: number, upTo: number) => {
      if (upTo > from) record(list.slice(from, upTo).map((r) => toEvent(info.code, r)))
      setSavedCount(Math.max(from, upTo))
    },
    [record, info.code],
  )
  // Leaving mid-session (back button, Change settings) still saves the grades.
  const latest = useRef({ results, savedCount, record })
  useEffect(() => {
    latest.current = { results, savedCount, record }
  }, [results, savedCount, record])
  useEffect(
    () => () => {
      const { results: rs, savedCount: n, record: rec } = latest.current
      if (rs.length > n) rec(rs.slice(n).map((r) => toEvent(info.code, r)))
    },
    [info.code],
  )

  const index = results.length
  const current = queue[index]
  // Spaced repetition plans its session up front (plus re-queued misses).
  const repeats = selection === 'random' || selection === 'weighted'
  const planned = selection === 'srs' ? queue.length : plannedCount(session.pool.length, session.length, repeats)
  const got = results.filter((r) => r.got).length

  const finish = useCallback(
    (final: Graded[]) => {
      setDone(true)
      saveGrades(final, savedCount, final.length)
      if (final.length === 0) return
      const correct = final.filter((r) => r.got).length
      saveSession({
        id: session.id,
        language: info.code,
        min_level: session.settings.min,
        max_level: session.settings.max,
        direction: session.settings.direction,
        selection: session.drill ? 'drill' : session.settings.starredOnly ? 'starred' : session.settings.selection,
        planned_length: typeof session.length === 'number' ? session.length : null,
        shown: final.length,
        correct,
        missed: final.length - correct,
        started_at: session.startedAt.toISOString(),
        ended_at: new Date().toISOString(),
      })
    },
    [saveSession, session, info.code, saveGrades, savedCount],
  )

  const grade = useCallback(
    (ok: boolean) => {
      if (!flipped || !current) return
      const next = [...results, { ...current, got: ok, at: Date.now() }]
      let q = queue
      // Spaced repetition: a missed card comes back later in the session.
      if (selection === 'srs' && !ok && q.filter((s) => sameShown(s, current)).length <= MAX_RETRIES) {
        const at = retryPosition(next.length - 1, q.length, Math.random)
        q = [...q.slice(0, at), { card: current.card, foreign: current.foreign }, ...q.slice(at)]
      }
      if (next.length >= q.length) {
        if (selection === 'shuffled' && session.length === 'endless') {
          q = [...q, ...shuffledShown(refill(session.pool, current.card.id))]
        } else if ((selection === 'random' || selection === 'weighted') && (planned === null || next.length < planned)) {
          q = [...q, pick(next)]
        }
      }
      setQueueBefore(queue)
      setQueue(q)
      setResults(next)
      setFlipped(false)
      if (next.length >= q.length) return finish(next)
      saveGrades(next, savedCount, next.length - 1)
    },
    [flipped, current, results, queue, selection, session, planned, pick, shuffledShown, saveGrades, savedCount, finish],
  )

  const canUndo = results.length > savedCount
  const undo = useCallback(() => {
    if (results.length <= savedCount) return
    setResults(results.slice(0, -1))
    if (queueBefore) setQueue(queueBefore)
    setQueueBefore(null)
    setFlipped(true)
  }, [results, savedCount, queueBefore])

  const end = useCallback(() => {
    if (results.length > 0) finish(results)
    else navigate(`/${info.code}`)
  }, [results, finish, navigate, info.code])

  // Keyboard shortcuts (SPEC §6.6).
  useEffect(() => {
    if (done) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      // Let a focused button handle its own Enter/Space activation.
      if ((k === ' ' || k === 'enter') && e.target instanceof HTMLButtonElement) return
      if ((k === ' ' || k === 'enter') && !flipped) setFlipped(true)
      else if (k === 'arrowright' || k === 'g') grade(true)
      else if (k === 'arrowleft' || k === 'm') grade(false)
      else if (k === 'z') undo()
      else if (k === '*' && userId && current) toggleStar(info.code, current.card.id)
      // Speak only when the foreign word is showing, so it never gives away the answer.
      else if (k === 's' && voice && current && (flipped || current.foreign)) speak(current.card.word, voice)
      else if (k === 'escape') end()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, flipped, grade, undo, end, userId, current, toggleStar, info.code, voice])

  if (done || !current) {
    if (session.pool.length === 0) {
      return (
        <Status action={<Link to={`/${info.code}`}>Change settings</Link>}>
          No words to quiz. With “Starred words only” on, star some words first.
        </Status>
      )
    }
    if (results.length === 0 && selection === 'srs') {
      return (
        <Status
          action={
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(`/${info.code}/quiz`, { replace: true, state: { start: Date.now(), selection: 'shuffled' } })
                }
                className="h-12 rounded-2xl bg-accent px-5 font-display text-lg font-extrabold text-accent-ink"
              >
                Shuffled session instead
              </button>
              <Link to={`/${info.code}`} className="font-bold text-ink">
                Change settings
              </Link>
            </div>
          }
        >
          Nothing is due for review in this range, and you've seen every word in it. Come back later, or quiz a shuffled
          deck now.
        </Status>
      )
    }
    return <Summary language={language} settings={session.settings} drill={session.drill} results={results} />
  }

  const progress = planned === null ? null : index / planned
  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col gap-4 px-5 pt-3 pb-6">
      <header className="flex items-center gap-3">
        <button type="button" onClick={end} aria-label="End session" className="flex size-11 items-center justify-center text-ink">
          <CloseIcon size={22} />
        </button>
        <div
          className="relative h-2.5 flex-1 rounded-full bg-track"
          role="progressbar"
          aria-label="Session progress"
          aria-valuenow={index}
          aria-valuemin={0}
          aria-valuemax={planned ?? undefined}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-[width]"
            style={{ width: progress === null ? '100%' : `${progress * 100}%`, opacity: progress === null ? 0.25 : 1 }}
          />
        </div>
        <span className="font-display text-base font-extrabold">
          {index + 1}
          {planned !== null && <span className="font-medium text-muted"> / {planned}</span>}
        </span>
      </header>

      <div className="flex justify-center gap-2.5 text-sm font-bold" aria-live="polite">
        <span className="flex items-center gap-1.5 rounded-full bg-good-soft px-3 py-1.5 text-good-soft-ink">
          <CheckIcon size={14} />
          {got} got it
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-miss-soft px-3 py-1.5 text-miss-soft-ink">
          <MissIcon size={14} />
          {results.length - got} missed
        </span>
      </div>

      <FlipCard
        key={index}
        shown={current}
        languageName={info.name}
        langCode={info.code}
        sectionTitle={language.sections[current.card.level] ?? ''}
        flipped={flipped}
        onFlip={() => setFlipped(true)}
        star={userId ? { on: starred.has(current.card.id), toggle: () => toggleStar(info.code, current.card.id) } : null}
        onSpeak={voice ? () => speak(current.card.word, voice) : null}
      />

      <div className="flex items-center gap-3">
        {flipped ? (
          <div className="grid flex-1 grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => grade(false)}
              className="flex h-15 items-center justify-center gap-2 rounded-2xl border-2 border-miss bg-surface font-display text-[19px] font-extrabold text-miss-ink"
            >
              <MissIcon /> Missed
            </button>
            <button
              type="button"
              onClick={() => grade(true)}
              className="flex h-15 items-center justify-center gap-2 rounded-2xl border-2 border-good bg-good font-display text-[19px] font-extrabold text-good-ink"
            >
              <CheckIcon /> Got it
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="flex h-15 flex-1 items-center justify-center rounded-2xl border-2 border-primary bg-primary font-display text-[19px] font-extrabold text-primary-ink"
          >
            Flip
          </button>
        )}
        {canUndo && (
          <button
            type="button"
            onClick={undo}
            aria-label="Undo last grade"
            title="Undo last grade (Z)"
            className="flex size-15 shrink-0 items-center justify-center rounded-2xl border-2 border-line bg-surface text-ink"
          >
            <UndoIcon size={22} />
          </button>
        )}
      </div>
    </div>
  )
}

const LONG_TEXT = 140

function FlipCard({
  shown,
  languageName,
  langCode,
  sectionTitle,
  flipped,
  onFlip,
  star,
  onSpeak,
}: {
  shown: Shown
  languageName: string
  langCode: string
  sectionTitle: string
  flipped: boolean
  onFlip: () => void
  star: { on: boolean; toggle: () => void } | null
  /** Says the foreign word; null when no matching voice is installed. */
  onSpeak: (() => void) | null
}) {
  const { card, foreign } = shown
  const [more, setMore] = useState(false)
  const prompt = foreign ? card.word : card.short
  const answer = foreign ? card.short : card.word
  const meanings = card.full
  const promptLang = foreign ? langCode : 'en'
  const answerLang = foreign ? 'en' : langCode

  // The front only offers the speaker when it shows the foreign word.
  const topRow = (visible: boolean, canSpeak: boolean) => (
    <div className="flex h-11 w-full items-center gap-1">
      <span className="flex flex-1 items-center gap-2 text-sm font-bold text-muted">
        <LevelTag level={card.level} />
        {sectionTitle}
      </span>
      {onSpeak && canSpeak && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSpeak()
          }}
          aria-label={`Hear “${card.word}”`}
          title="Hear it (S)"
          tabIndex={visible ? 0 : -1}
          className="flex size-11 items-center justify-center rounded-full bg-chip text-ink"
        >
          <SpeakerIcon size={22} />
        </button>
      )}
      {star && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            star.toggle()
          }}
          aria-pressed={star.on}
          aria-label={star.on ? 'Unstar this word' : 'Star this word'}
          tabIndex={visible ? 0 : -1}
          className="flex size-11 items-center justify-center rounded-full bg-chip text-ink"
        >
          <StarIcon size={22} filled={star.on} />
        </button>
      )}
    </div>
  )
  const face = 'flip-face flex flex-col rounded-3xl border-2 border-card-border bg-surface p-[18px] shadow-[0_6px_0_var(--shadow)]'

  return (
    <div className="flip min-h-0 flex-1">
      <div className={`flip-inner ${flipped ? 'flipped' : ''}`}>
        {/* Tapping anywhere on the front flips it; keyboard users have the Flip button and Space. */}
        <div onClick={onFlip} className={`${face} cursor-pointer text-ink`} aria-hidden={flipped}>
          {topRow(!flipped, foreign)}
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden">
            <span className="text-[13px] font-bold tracking-[1px] text-muted uppercase">
              {foreign ? languageName : 'English'}
            </span>
            <span
              lang={promptLang}
              className={`max-w-full text-center font-display leading-[1.08] font-extrabold tracking-tight break-words hyphens-auto ${frontSize(prompt)}`}
            >
              {prompt}
            </span>
          </div>
          <span className="w-full text-center text-sm text-muted">Tap the card to flip</span>
        </div>

        <div className={`${face} flip-back gap-3.5`} aria-hidden={!flipped} aria-live="polite">
          {topRow(flipped, true)}
          <div
            lang={promptLang}
            className={`border-b-[1.5px] border-dashed border-track pb-3.5 font-display font-bold break-words hyphens-auto ${recapSize(prompt)}`}
          >
            {prompt}
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4.5 overflow-y-auto">
            <p
              lang={answerLang}
              className={`m-0 font-display leading-[1.12] font-extrabold tracking-tight break-words hyphens-auto ${answerSize(answer)}`}
            >
              {answer}
            </p>
            {meanings && (
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-bold tracking-[1px] text-muted uppercase">All meanings</span>
                <p className={`m-0 text-base leading-relaxed text-muted ${more ? '' : 'line-clamp-4'}`}>{meanings}</p>
                {meanings.length > LONG_TEXT && (
                  <button
                    type="button"
                    onClick={() => setMore((m) => !m)}
                    className="self-start py-1 text-sm font-bold text-ink underline"
                    tabIndex={flipped ? 0 : -1}
                  >
                    {more ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
