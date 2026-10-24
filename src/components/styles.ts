/** Shared Tailwind class strings for the "Ladder" look. */

export const btnPrimary =
  'flex h-14 w-full items-center justify-center rounded-2xl border-2 border-primary bg-primary font-display text-[19px] font-extrabold text-primary-ink disabled:opacity-40'
export const btnAccent =
  'flex h-14 w-full items-center justify-center rounded-2xl bg-accent font-display text-[19px] font-extrabold text-accent-ink shadow-[0_3px_0_var(--shadow)] disabled:opacity-40 disabled:shadow-none'
export const pill = (on: boolean) =>
  `h-11 min-w-13 rounded-full border-[1.5px] px-3.5 text-[15px] font-bold ${
    on ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-ink'
  }`
