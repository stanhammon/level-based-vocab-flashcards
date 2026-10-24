import { btnAccent, pill } from '@/components/styles'
import { ChevronDown, Header, Page, SectionLabel, Status } from '@/components/ui'
import { inRange, plannedCount } from '@/lib/deck'
import { directionLabels } from '@/lib/labels'
import { useProgress, useStarred } from '@/lib/progressContext'
import { LENGTH_CHOICES, loadSettings, saveLastLanguage, saveSettings, type SessionSettings } from '@/lib/settings'
import { useLanguage, type Language } from '@/lib/words'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { LevelRange } from './LevelRange'

export function SetupPage() {
  const { lang } = useParams()
  const language = useLanguage(lang)
  const { settingsVersion } = useProgress()
  if (language.status === 'loading') return <Status>Loading words…</Status>
  if (language.status === 'missing') {
    return (
      <Status action={<Link to="/languages">Pick a language</Link>}>That language isn't available.</Status>
    )
  }
  if (language.status === 'error') return <Status>Couldn't load the words. Check your connection and reload.</Status>
  // Remount when settings arrive from the account so the screen shows them.
  return <Setup key={`${language.data.info.code}:${settingsVersion}`} language={language.data} />
}

function Setup({ language }: { language: Language }) {
  const { info, sections, cards } = language
  const navigate = useNavigate()
  const [s, setS] = useState<SessionSettings>(() => loadSettings(info))
  const update = (patch: Partial<SessionSettings>) => setS((prev) => ({ ...prev, ...patch }))

  useEffect(() => saveLastLanguage(info.code), [info.code])
  const { userId, pushSettings } = useProgress()
  const starred = useStarred(info.code)
  useEffect(() => {
    saveSettings(info.code, s)
    pushSettings(info.code, s)
  }, [info.code, s, pushSettings])

  const ranged = useMemo(() => inRange(cards, s.min, s.max), [cards, s.min, s.max])
  const starredInRange = useMemo(() => ranged.filter((c) => starred.has(c.id)).length, [ranged, starred])
  const starredOnly = s.starredOnly && userId !== null
  const available = starredOnly ? starredInRange : ranged.length
  const planned = plannedCount(available, s.length)
  const labels = directionLabels(info.code)

  return (
    <Page>
      <Header languageName={info.name} />
      <main className="flex flex-1 flex-col gap-4 px-5 pt-1 pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="m-0 font-display text-[30px] leading-tight font-extrabold tracking-tight">Set up a session</h1>
          {userId && (
            <Link to={`/${info.code}/progress`} className="shrink-0 text-[15px] font-bold text-ink">
              Progress
            </Link>
          )}
        </div>
        {info.sample && (
          <p className="m-0 rounded-xl bg-miss-soft px-3 py-2 text-sm text-miss-soft-ink">
            This is the built-in sample list. Add real word lists to the data folder and redeploy.
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-[18px] bg-surface p-4 shadow-[0_1px_2px_rgba(22,33,58,0.08)]">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Levels</SectionLabel>
            <span className="text-sm text-muted" aria-live="polite">
              <strong className="text-ink">{available.toLocaleString()}</strong> words in range
            </span>
          </div>
          <LevelRange
            lo={info.minLevel}
            hi={info.maxLevel}
            min={s.min}
            max={s.max}
            sections={sections}
            onChange={(min, max) => update({ min, max })}
          />
        </section>

        {userId && (starredInRange > 0 || s.starredOnly) && (
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-[14px] bg-surface px-4 py-2 shadow-[0_1px_2px_rgba(22,33,58,0.08)]">
            <span className="flex flex-col">
              <span className="font-bold">Starred words only</span>
              <span className="text-sm text-muted">{starredInRange.toLocaleString()} starred in this range</span>
            </span>
            <input
              type="checkbox"
              checked={s.starredOnly}
              onChange={(e) => update({ starredOnly: e.target.checked })}
              className="size-6 accent-[var(--good)]"
            />
          </label>
        )}

        <section className="flex flex-col gap-2">
          <SectionLabel>Direction</SectionLabel>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-track p-1" role="group" aria-label="Direction">
            {(['forward', 'reverse', 'mixed'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={s.direction === d}
                onClick={() => update({ direction: d })}
                className={`h-10 rounded-[9px] text-[15px] font-bold ${
                  s.direction === d ? 'bg-primary text-primary-ink' : 'text-ink'
                }`}
              >
                {labels[d]}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel htmlFor="order">Card order</SectionLabel>
          <div className="relative">
            <select
              id="order"
              value={s.selection}
              onChange={() => update({ selection: 'shuffled' })}
              className="h-12 w-full appearance-none rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base text-ink"
            >
              <option value="shuffled">Shuffled deck — no repeats</option>
              <option disabled>Random (coming soon)</option>
              <option disabled>Weighted toward misses (coming soon)</option>
              <option disabled>Spaced repetition (coming soon)</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute top-4 right-3.5" />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <SectionLabel>Length</SectionLabel>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Length">
            {LENGTH_CHOICES.map((len) => (
              <button
                key={len}
                type="button"
                aria-pressed={s.length === len}
                onClick={() => update({ length: len })}
                className={pill(s.length === len)}
              >
                {len === 'all' ? `All ${available.toLocaleString()}` : len === 'endless' ? 'Endless' : len}
              </button>
            ))}
          </div>
        </section>

        <div className="flex-1" />
        <button
          type="button"
          disabled={available === 0}
          onClick={() => navigate(`/${info.code}/quiz`, { state: { start: Date.now() } })}
          className={btnAccent}
        >
          {available === 0
            ? 'No words in this range'
            : planned === null
              ? 'Start · endless'
              : `Start · ${planned.toLocaleString()} ${planned === 1 ? 'card' : 'cards'}`}
        </button>
      </main>
    </Page>
  )
}
