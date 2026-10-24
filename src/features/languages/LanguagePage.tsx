import { ChevronRight, Logo, Page, Status } from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import { loadLastLanguage, saveLastLanguage } from '@/lib/settings'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useManifest } from '@/lib/words'
import { Link, Navigate } from 'react-router'

const BADGE_COLORS = ['bg-accent', 'bg-[#9db8ff]', 'bg-[#7fd1b9]', 'bg-[#f59e8b]']

/** `/`: go straight to the last-used language, if it still exists. */
export function HomeRedirect() {
  const manifest = useManifest()
  if (manifest.status === 'loading') return <Status>Loading…</Status>
  const last = loadLastLanguage()
  if (manifest.status === 'ready' && manifest.data.languages.some((l) => l.code === last)) {
    return <Navigate to={`/${last}`} replace />
  }
  return <LanguagePage />
}

export function LanguagePage() {
  const manifest = useManifest()
  const { session } = useAuth()
  if (manifest.status === 'loading') return <Status>Loading…</Status>
  if (manifest.status === 'error') return <Status>Couldn't load the word lists. Check your connection and reload.</Status>

  return (
    <Page>
      <div className="flex flex-1 flex-col gap-7 px-5 pt-14 pb-7">
        <div className="flex flex-col gap-4">
          <Logo size={64} />
          <h1 className="m-0 font-display text-[40px] leading-[1.05] font-extrabold tracking-tight">
            Climb your vocab, one level at a time.
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-muted">
            Pick a language to start. You can switch any time from the top bar.
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {manifest.data.languages.map((l, i) => (
            <li key={l.code}>
              <Link
                to={`/${l.code}`}
                onClick={() => saveLastLanguage(l.code)}
                className="flex items-center gap-3.5 rounded-[18px] border-2 border-card-border bg-surface p-4 text-ink no-underline shadow-[0_3px_0_var(--shadow)]"
              >
                <span
                  className={`flex size-12 items-center justify-center rounded-xl font-display text-lg font-extrabold text-accent-ink ${BADGE_COLORS[i % BADGE_COLORS.length]}`}
                  aria-hidden="true"
                >
                  {l.code.toUpperCase()}
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-display text-[21px] font-extrabold">{l.name}</span>
                  <span className="text-sm text-muted">
                    {l.count.toLocaleString()} words · levels {l.minLevel}–{l.maxLevel}
                    {l.sample && ' · sample list'}
                  </span>
                </span>
                <ChevronRight />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex-1" />
        {session ? (
          <p className="m-0 text-center text-[15px] text-muted">
            Signed in as {session.user.email}. <Link to="/account?from=/languages" className="font-bold text-ink">Account</Link>
          </p>
        ) : (
          <p className="m-0 text-center text-[15px] text-muted">
            No account needed.
            {isSupabaseConfigured && (
              <>
                {' '}
                <Link to="/account?from=/languages" className="font-bold text-ink">
                  Sign in
                </Link>{' '}
                to sync progress across devices.
              </>
            )}
          </p>
        )}
      </div>
    </Page>
  )
}
