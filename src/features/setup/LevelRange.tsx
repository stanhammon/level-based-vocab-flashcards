import { CloseIcon } from '@/components/ui'
import { searchLevels, setFrom, setTo, type Range } from '@/lib/levels'
import { useMemo, useState } from 'react'

interface Props {
  lo: number
  hi: number
  min: number
  max: number
  sections: Record<number, string>
  onChange: (min: number, max: number) => void
}

const RESULTS_SHOWN = 8

/**
 * From/To level pickers with −/+ steppers and a search over level titles
 * (SPEC §6.1). Typed numbers apply on blur/Enter. From never passes To: moving
 * one end past the other brings it along.
 */
export function LevelRange({ lo, hi, min, max, sections, onChange }: Props) {
  const range: Range = { min, max }
  const apply = (r: Range) => onChange(r.min, r.max)
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchLevels(sections, query), [sections, query])

  return (
    <div className="flex flex-col gap-3.5">
      <LevelField
        id="lvl-min"
        label="From"
        value={min}
        lo={lo}
        hi={hi}
        title={sections[min]}
        onSet={(n) => apply(setFrom(range, n, lo, hi))}
      />
      <LevelField
        id="lvl-max"
        label="To"
        value={max}
        lo={lo}
        hi={hi}
        title={sections[max]}
        onSet={(n) => apply(setTo(range, n, lo, hi))}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="lvl-search" className="text-[13px] font-bold text-muted">
          Find a level by title
        </label>
        <div className="relative">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
            className="pointer-events-none absolute top-[13px] left-3 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id="lvl-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. café, hobbies, 150"
            aria-controls="lvl-results"
            className="h-11 w-full rounded-[10px] border-[1.5px] border-line bg-surface pr-11 pl-9 text-base text-ink placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute top-0 right-0 flex size-11 items-center justify-center text-muted"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {query.trim() && (
          <div id="lvl-results" aria-live="polite">
            {results.length === 0 ? (
              <p className="m-0 py-1 text-sm text-muted">No level titles match “{query.trim()}”.</p>
            ) : (
              <>
                <ul className="m-0 list-none p-0">
                  {results.slice(0, RESULTS_SHOWN).map((r, i) => (
                    <li
                      key={r.level}
                      className={`flex items-center gap-2 py-2 ${i > 0 ? 'border-t border-track' : ''}`}
                    >
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className="shrink-0 font-display text-sm font-extrabold">L{r.level}</span>
                        <span className="min-w-0 text-sm leading-snug break-words">{r.title}</span>
                      </span>
                      {(
                        [
                          ['From', min === r.level, () => apply(setFrom(range, r.level, lo, hi))],
                          ['To', max === r.level, () => apply(setTo(range, r.level, lo, hi))],
                        ] as const
                      ).map(([label, on, act]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={act}
                          aria-pressed={on}
                          aria-label={`Set ${label} to level ${r.level}`}
                          className={`h-11 shrink-0 rounded-[10px] border-[1.5px] px-3 text-sm font-bold ${
                            on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-ink'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
                {results.length > RESULTS_SHOWN && (
                  <p className="m-0 pt-1 text-sm text-muted">
                    {results.length - RESULTS_SHOWN} more — keep typing to narrow it down.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function LevelField({
  id,
  label,
  value,
  lo,
  hi,
  title,
  onSet,
}: {
  id: string
  label: string
  value: number
  lo: number
  hi: number
  title: string | undefined
  onSet: (level: number) => void
}) {
  // While the number is being typed it holds a draft; otherwise it shows the value.
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const n = Number(draft)
    if (draft !== null && draft.trim() !== '' && Number.isFinite(n)) onSet(Math.round(n))
    setDraft(null)
  }
  const step =
    'flex size-11 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-line bg-surface font-display text-2xl leading-none font-bold text-ink disabled:opacity-35'

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-bold text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2.5">
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onSet(value - 1)}
            disabled={value <= lo}
            aria-label={`${label}: one level lower`}
            className={step}
          >
            −
          </button>
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={lo}
            max={hi}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="h-11 w-16 [appearance:textfield] rounded-[10px] border-[1.5px] border-line bg-surface px-1 text-center font-display text-xl font-bold text-ink [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onSet(value + 1)}
            disabled={value >= hi}
            aria-label={`${label}: one level higher`}
            className={step}
          >
            +
          </button>
        </div>
        <span className="min-w-0 flex-1 text-sm leading-snug break-words text-muted">{title ?? '—'}</span>
      </div>
    </div>
  )
}
