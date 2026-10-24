import type { ReactNode, SVGProps } from 'react'
import { useAuth } from '@/lib/authContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Link, useLocation } from 'react-router'

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="18" width="7" height="8" rx="2" className="fill-ink" />
      <rect x="10.5" y="11" width="7" height="15" rx="2" className="fill-ink" />
      <rect x="19" y="3" width="7" height="23" rx="2" className="fill-accent" />
    </svg>
  )
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const CheckIcon = (p: IconProps) => <Svg strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></Svg>
export const MissIcon = (p: IconProps) => <Svg strokeWidth={3} {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const ChevronDown = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const ChevronRight = (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
export const UserIcon = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Svg>
)
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg strokeWidth={2} fill={filled ? 'var(--accent)' : 'none'} {...p}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  </Svg>
)
export const UndoIcon = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />
  </Svg>
)

/** Top bar with the wordmark, the current-language switcher and the account button. */
export function Header({ languageName }: { languageName?: string }) {
  const { session } = useAuth()
  const { pathname } = useLocation()
  return (
    <header className="flex items-center gap-2 px-5 py-4">
      <Link to="/languages" className="flex items-center gap-2.5 no-underline text-ink" aria-label="Level Vocab home">
        <Logo />
        <span className="font-display text-lg font-extrabold tracking-tight">Level Vocab</span>
      </Link>
      <div className="flex-1" />
      {languageName && (
        <Link
          to="/languages"
          className="flex h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line bg-surface px-3.5 text-[15px] font-bold text-ink no-underline"
        >
          {languageName}
          <ChevronDown size={14} />
          <span className="sr-only">(change language)</span>
        </Link>
      )}
      {isSupabaseConfigured && pathname !== '/account' && (
        <Link
          to={`/account?from=${encodeURIComponent(pathname)}`}
          aria-label={session ? 'Account (signed in)' : 'Sign in'}
          className="relative flex size-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-surface text-ink"
        >
          <UserIcon />
          {session && <span className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-surface bg-good" />}
        </Link>
      )}
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">{children}</div>
}

export function SectionLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  const cls = 'm-0 text-[15px] font-bold uppercase tracking-[0.8px] text-muted'
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <h2 className={cls}>{children}</h2>
  )
}

export function LevelTag({ level }: { level: number }) {
  return (
    <span className="rounded-lg bg-accent px-2 py-1 font-display font-extrabold text-accent-ink">L{level}</span>
  )
}

/** Full-page message for loading and error states. */
export function Status({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Page>
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 text-center text-muted" role="status">
        {children}
        {action}
      </div>
    </Page>
  )
}
