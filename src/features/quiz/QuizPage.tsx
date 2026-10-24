import { CheckIcon, CloseIcon, LevelTag, MissIcon, StarIcon, Status, UndoIcon } from '@/components/ui'
import { inRange, plannedCount, promptIsForeign, refill, startQueue, type Card, type SessionLength } from '@/lib/deck'
import { useProgress, useStarred } from '@/lib/progressContext'
import { loadSettings, type SessionSettings } from '@/lib/settings'
import type { GradeEvent, StatDirection } from '@/lib/stats'
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
}

export function QuizPage() {
  const { lang } = useParams()
  const location = useLocation()
  const language = useLanguage(lang)
  const { userId, starred, loadStarred } = useProgress()
  const info = language.status === 'ready' ? language.data.info : null
  // A starred-only session can't start until the stars have loaded.
  const needStars = info !== null && userId !== null && loadSettings(info).starredOnly
  const code = info?.code

  useEffect(() => {
    if (needStars && code) loadStarred(code)
  }, [needStars, code, loadStarred])

  if (language.status === 'loading') return <Status>Loading words…</Status>
  if (language.status !== 'ready') {
    return <Status action={<Link to="/languages">Pick a language</Link>}>Couldn't load that language.</Status>
  }
  if (needStars && !starred[language.data.info.code]) return <Status>Loading starred words…</Status>
  // A new key (from Start, Again or Drill) starts a fresh session.
  return <Quiz key={location.key} language={language.data} state={location.state as QuizState | null} />
}

export interface Shown {
  card: Card
  foreign: boolean
}
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

function Quiz({ language, state }: { language: Language; state: QuizState | null }) {
  const navigate = useNavigate()
  const { info } = language
  const { userId, record, saveSession, toggleStar } = useProgress()
  const starred = useStarred(info.code)

  const [session] = useState(() => {
    const saved: SessionSettings = loadSettings(info)
    const settings = state?.direction ? { ...saved, direction: state.direction } : saved
    const drill = state?.drill ? new Set(state.drill) : null
    let pool = drill ? language.cards.filter((c) => drill.has(c.id)) : inRange(language.cards, settings.min, settings.max)
    if (!drill && settings.starredOnly && userId) pool = pool.filter((c) => starred.has(c.id))
    const length: SessionLength = drill ? 'all' : settings.length
    return { settings, pool, length, drill: drill !== null, id: crypto.randomUUID(), startedAt: new Date() }
  })
  const draw = useCallback(
    (cards: Card[]): Shown[] => cards.map((card) => ({ card, foreign: promptIsForeign(session.settings.direction) })),
    [session.settings.direction],
  )

  const [queue, setQueue] = useState<Shown[]>(() => draw(startQueue(session.pool, session.length)))
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
  const planned = plannedCount(session.pool.length, session.length)
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
      setResults(next)
      setFlipped(false)
      if (next.length >= queue.length && session.length !== 'endless') return finish(next)
      saveGrades(next, savedCount, next.length - 1)
      if (next.length >= queue.length) setQueue((q) => [...q, ...draw(refill(session.pool, current.card.id))])
    },
    [flipped, current, results, queue.length, session, draw, saveGrades, savedCount, finish],
  )

  const canUndo = results.length > savedCount
  const undo = useCallback(() => {
    if (results.length <= savedCount) return
    setResults(results.slice(0, -1))
    setFlipped(true)
  }, [results, savedCount])

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
      else if (k === 'escape') end()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, flipped, grade, undo, end, userId, current, toggleStar, info.code])

  if (done || !current) {
    if (session.pool.length === 0) {
      return (
        <Status action={<Link to={`/${info.code}`}>Change settings</Link>}>
          No words to quiz. With “Starred words only” on, star some words first.
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
}: {
  shown: Shown
  languageName: string
  langCode: string
  sectionTitle: string
  flipped: boolean
  onFlip: () => void
  star: { on: boolean; toggle: () => void } | null
}) {
  const { card, foreign } = shown
  const [more, setMore] = useState(false)
  const prompt = foreign ? card.word : card.short
  const answer = foreign ? card.short : card.word
  const meanings = card.full
  const promptLang = foreign ? langCode : 'en'
  const answerLang = foreign ? 'en' : langCode

  const topRow = (visible: boolean) => (
    <div className="flex h-11 w-full items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-bold text-muted">
        <LevelTag level={card.level} />
        {sectionTitle}
      </span>
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
          {topRow(!flipped)}
          <div className="flex w-full flex-1 flex-col items-center justify-center gap-2.5 overflow-hidden">
            <span className="text-[13px] font-bold tracking-[1px] text-muted uppercase">
              {foreign ? languageName : 'English'}
            </span>
            <span
              lang={promptLang}
              className={`text-center font-display leading-[1.08] font-extrabold tracking-tight break-words ${
                prompt.length > 28 ? 'text-3xl' : 'text-5xl'
              }`}
            >
              {prompt}
            </span>
          </div>
          <span className="w-full text-center text-sm text-muted">Tap the card to flip</span>
        </div>

        <div className={`${face} flip-back gap-3.5`} aria-hidden={!flipped} aria-live="polite">
          {topRow(flipped)}
          <div
            lang={promptLang}
            className="border-b-[1.5px] border-dashed border-track pb-3.5 font-display text-[26px] font-bold break-words"
          >
            {prompt}
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-4.5 overflow-y-auto">
            <p
              lang={answerLang}
              className={`m-0 font-display leading-[1.12] font-extrabold tracking-tight break-words ${
                answer.length > 60 ? 'text-2xl' : 'text-[34px]'
              }`}
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
