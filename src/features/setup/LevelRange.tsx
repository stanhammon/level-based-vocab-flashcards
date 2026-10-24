import { useState } from 'react'

interface Props {
  lo: number
  hi: number
  min: number
  max: number
  sections: Record<number, string>
  onChange: (min: number, max: number) => void
}

/**
 * Two-handle slider plus editable From/To fields, kept in sync (SPEC §6.1).
 * Typed values are applied on blur/Enter, clamped, and swapped if reversed.
 */
export function LevelRange({ lo, hi, min, max, sections, onChange }: Props) {
  // While a field is being edited it holds a draft; otherwise it shows the value.
  const [minDraft, setMinDraft] = useState<string | null>(null)
  const [maxDraft, setMaxDraft] = useState<string | null>(null)
  const minText = minDraft ?? String(min)
  const maxText = maxDraft ?? String(max)

  const clamp = (n: number) => Math.min(hi, Math.max(lo, Math.round(n)))
  const commit = () => {
    const a = Number(minText)
    const b = Number(maxText)
    const na = Number.isFinite(a) && minText.trim() !== '' ? clamp(a) : min
    const nb = Number.isFinite(b) && maxText.trim() !== '' ? clamp(b) : max
    onChange(Math.min(na, nb), Math.max(na, nb))
    setMinDraft(null)
    setMaxDraft(null)
  }

  const span = Math.max(1, hi - lo)
  const left = ((min - lo) / span) * 100
  const right = ((max - lo) / span) * 100
  const field =
    'h-11 w-full rounded-[10px] border-[1.5px] border-line bg-surface px-3 font-display text-xl font-bold text-ink'

  return (
    <div className="flex flex-col gap-3">
      <div className="range-pair">
        <div className="absolute inset-x-[14px] top-[19px] h-1.5 rounded-full bg-track">
          <div className="absolute h-full rounded-full bg-primary" style={{ left: `${left}%`, width: `${right - left}%` }} />
        </div>
        <input
          type="range"
          aria-label="Lowest level"
          min={lo}
          max={hi}
          value={min}
          onChange={(e) => onChange(Math.min(Number(e.target.value), max), max)}
          // The high handle sits on top, except when both are pushed to the top
          // end, where only the low handle can still move.
          style={{ zIndex: max === hi && min >= hi - span * 0.02 ? 3 : 1 }}
        />
        <input
          type="range"
          className="range-max"
          style={{ zIndex: 2 }}
          aria-label="Highest level"
          min={lo}
          max={hi}
          value={max}
          onChange={(e) => onChange(min, Math.max(Number(e.target.value), min))}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            ['From', 'lvl-min', minText, setMinDraft, min],
            ['To', 'lvl-max', maxText, setMaxDraft, max],
          ] as const
        ).map(([label, id, text, setText, value]) => (
          <div key={id} className="flex min-w-0 flex-col gap-1">
            <label htmlFor={id} className="text-[13px] font-bold text-muted">
              {label}
            </label>
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={lo}
              max={hi}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              className={field}
            />
            <span className="text-sm leading-snug break-words text-muted">{sections[value] ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
