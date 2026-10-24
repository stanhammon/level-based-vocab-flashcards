import { btnAccent, btnPrimary } from '@/components/styles'
import { Header, Page, SectionLabel } from '@/components/ui'
import { useAuth } from '@/lib/authContext'
import { useProgress } from '@/lib/progressContext'
import { loadLastLanguage } from '@/lib/settings'
import { errorMessage, isSupabaseConfigured, supabase } from '@/lib/supabase'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'

const RESEND_SECONDS = 60
const field =
  'h-12 w-full rounded-xl border-[1.5px] border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted'

export function AccountPage() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const from = params.get('from')
  const back = from?.startsWith('/') && !from.startsWith('//') ? from : '/'

  return (
    <Page>
      <Header />
      <main className="flex flex-1 flex-col gap-5 px-5 pt-1 pb-6">
        <h1 className="m-0 font-display text-[30px] leading-tight font-extrabold tracking-tight">
          {session ? 'Your account' : 'Sign in'}
        </h1>
        {!isSupabaseConfigured ? (
          <p className="m-0 text-muted">Sign-in isn't set up for this copy of the app.</p>
        ) : loading ? (
          <p className="m-0 text-muted" role="status">
            Loading…
          </p>
        ) : session ? (
          <SignedIn email={session.user.email ?? ''} />
        ) : (
          <SignInForm />
        )}
        <div className="flex-1" />
        <Link to={back} className="text-center font-bold text-ink">
          Back
        </Link>
      </main>
    </Page>
  )
}

function SignedIn({ email }: { email: string }) {
  const { signOut } = useAuth()
  const { pendingCount } = useProgress()
  const [busy, setBusy] = useState(false)
  const last = loadLastLanguage()

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-1 rounded-[18px] bg-surface p-4 shadow-[0_1px_2px_rgba(22,33,58,0.08)]">
        <SectionLabel>Signed in as</SectionLabel>
        <p className="m-0 text-lg font-bold break-all">{email}</p>
        <p className="m-0 text-sm text-muted">
          Your settings, results, session history and starred words sync across your devices.
          {pendingCount > 0 && ` ${pendingCount} recent ${pendingCount === 1 ? 'grade is' : 'grades are'} waiting to upload.`}
        </p>
      </section>
      {last && (
        <Link to={`/${last}/progress`} className={`${btnPrimary} no-underline`}>
          See your progress
        </Link>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await signOut()
          setBusy(false)
        }}
        className="h-12 rounded-2xl border-2 border-line bg-surface font-bold text-ink"
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      <p className="m-0 text-sm text-muted">
        Signing out keeps your account's progress safe. While signed out, results are saved on this device only.
      </p>
    </div>
  )
}

function SignInForm() {
  const { authError, clearAuthError } = useAuth()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [localError, setError] = useState<string | null>(null)
  const error = localError ?? authError

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    clearAuthError()
    const target = email.trim()
    const { error } = await supabase.auth.signInWithOtp({
      email: target,
      options: { emailRedirectTo: window.location.origin + '/account' },
    })
    setBusy(false)
    if (error) return setError(errorMessage(error))
    setSentTo(target)
    setCooldown(RESEND_SECONDS)
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (!sentTo) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(errorMessage(error))
  }

  const errorText = error && (
    <p className="m-0 rounded-xl bg-miss-soft px-3 py-2 text-sm text-miss-soft-ink" role="alert">
      {error}
    </p>
  )

  if (!sentTo) {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-4">
        <p className="m-0 text-[17px] leading-relaxed text-muted">
          Signing in syncs your progress across devices. You don't need an account to quiz.
        </p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[15px] font-bold">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={field}
          />
          <span className="text-sm text-muted">
            No password. If you use SafeOrder, use the same email. New here? This creates your account.
          </span>
        </div>
        {errorText}
        <button type="submit" className={btnAccent} disabled={busy || !email.trim()}>
          {busy ? 'Sending…' : 'Email me a sign-in code'}
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[17px] leading-relaxed text-muted">
        We sent a code to <strong className="text-ink">{sentTo}</strong>. Type the 6-digit code below, or open the link
        in the email on this device.
      </p>
      <form onSubmit={verifyCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-[15px] font-bold">
            Code from the email
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className={`${field} font-display text-2xl font-bold tracking-[4px]`}
          />
        </div>
        {errorText}
        <button type="submit" className={btnAccent} disabled={busy || code.length < 6}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" className="py-2 font-bold text-ink underline" onClick={() => setSentTo(null)}>
          Use a different email
        </button>
        <button
          type="button"
          className="py-2 font-bold text-ink underline disabled:text-muted disabled:no-underline"
          disabled={cooldown > 0 || busy}
          onClick={() => sendCode()}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
        </button>
      </div>
      <p className="m-0 text-sm text-muted">Didn't get it? Check your spam folder.</p>
    </div>
  )
}
