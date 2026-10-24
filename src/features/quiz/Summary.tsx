import { btnAccent, btnPrimary } from '@/components/styles'
import { directionLabels } from '@/lib/labels'
import { useProgress } from '@/lib/progressContext'
import type { SessionSettings } from '@/lib/settings'
import type { Language } from '@/lib/words'
import { Link, useNavigate } from 'react-router'
import type { Graded, QuizState } from './QuizPage'

const ORDER_NAMES = { shuffled: 'Shuffled', random: 'Random', weighted: 'Weighted', srs: 'Spaced repetition' } as const

/** End-of-session screen (SPEC §6.5). */
export function Summary({
  language,
  settings,
  drill,
  results,
}: {
  language: Language
  settings: SessionSettings
  drill: boolean
  results: Graded[]
}) {
  const navigate = useNavigate()
  const { userId } = useProgress()
  const { info } = language
  const total = results.length
  const got = results.filter((r) => r.got).length
  const pct = total ? Math.round((got / total) * 100) : 0

  // A card can be shown more than once in endless mode; list each miss once.
  const missed = [...new Map(results.filter((r) => !r.got).map((r) => [r.card.id, r.card])).values()]

  // Mixed sessions: each direction is tracked on its own (SPEC §6.2).
  const labels = directionLabels(info.code)
  const split =
    settings.direction === 'mixed' && total > 0
      ? ([true, false] as const)
          .map((foreign) => {
            const rs = results.filter((r) => r.foreign === foreign)
            return { label: labels[foreign ? 'forward' : 'reverse'], got: rs.filter((r) => r.got).length, total: rs.length }
          })
          .filter((d) => d.total > 0)
      : []

  const restart = (state: QuizState) => navigate(`/${info.code}/quiz`, { replace: true, state })
  const context = drill
    ? 'Missed-word drill'
    : `Levels ${settings.min}–${settings.max} · ${labels[settings.direction]} · ${settings.starredOnly ? 'Starred · ' : ''}${ORDER_NAMES[settings.selection]}`

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4.5 px-5 pt-7 pb-6">
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-sm font-bold tracking-[1px] text-muted uppercase">
          {total === 0 ? 'Session ended' : 'Session complete'}
        </span>
        <div className="flex items-end gap-2.5">
          <span className="font-display text-[76px] leading-none font-extrabold tracking-tighter">{got}</span>
          <span className="pb-2 font-display text-3xl font-bold text-muted">/ {total}</span>
        </div>
        {total > 0 && (
          <div
            className="mt-1.5 flex h-[18px] w-full max-w-[300px] gap-1"
            role="img"
            aria-label={`${got} got it, ${total - got} missed`}
          >
            {got > 0 && <div className="rounded-[5px] bg-good" style={{ flexGrow: got }} />}
            {total - got > 0 && <div className="rounded-[5px] bg-miss-bar" style={{ flexGrow: total - got }} />}
          </div>
        )}
        <span className="text-[15px] text-muted">
          {pct}% · {context}
        </span>
        {split.length > 0 && (
          <span className="text-[15px] font-bold">
            {split.map((d) => `${d.label} ${d.got}/${d.total}`).join(' · ')}
          </span>
        )}
      </div>

      {missed.length > 0 && (
        <section className="flex flex-col rounded-[18px] bg-surface px-4 py-1.5 shadow-[0_1px_2px_rgba(22,33,58,0.08)]">
          <h2 className="mt-2.5 mb-1 text-[15px] font-bold tracking-[0.8px] text-muted uppercase">Missed words</h2>
          <ul className="m-0 list-none p-0">
            {missed.map((c, i) => (
              <li key={c.id} className={`flex flex-col gap-0.5 py-2.5 ${i < missed.length - 1 ? 'border-b border-track' : ''}`}>
                <span lang={info.code} className="font-display text-[19px] font-bold">
                  {c.word}
                </span>
                <span className="text-[15px] text-muted">
                  {c.short} · L{c.level}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex-1" />
      <div className="flex flex-col gap-2.5">
        {missed.length > 0 && (
          <button
            type="button"
            className={btnAccent}
            onClick={() => restart({ start: Date.now(), drill: missed.map((c) => c.id) })}
          >
            Drill the {missed.length} missed {missed.length === 1 ? 'word' : 'words'}
          </button>
        )}
        {!drill && (
          <button type="button" className={btnPrimary} onClick={() => restart({ start: Date.now() })}>
            Same settings again
          </button>
        )}
        <div className="flex justify-center gap-8">
          <button
            type="button"
            onClick={() => navigate(`/${info.code}`)}
            className="h-12 text-base font-bold text-ink underline"
          >
            Change settings
          </button>
          {userId && (
            <Link to={`/${info.code}/progress`} className="flex h-12 items-center text-base font-bold text-ink">
              See your progress
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
