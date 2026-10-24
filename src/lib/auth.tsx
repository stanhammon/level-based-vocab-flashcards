import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext } from './authContext'
import { removeAll } from './storage'
import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Finish a sign-in link redirect (same approach as SafeOrder). Supabase sends
 * people back with ?code=… (PKCE) or ?error_description=…. Module-level so
 * StrictMode's double effect doesn't spend the code twice.
 */
let redirectResult: Promise<string | null> | null = null

function completeRedirect(): Promise<string | null> {
  redirectResult ??= (async () => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    const code = url.searchParams.get('code')
    const reported = url.searchParams.get('error_description') ?? hash.get('error_description')
    if (!code && !reported) return null

    for (const key of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(key)
    window.history.replaceState(null, '', url.pathname + url.search)

    if (reported) return reported
    const { error } = await supabase.auth.exchangeCodeForSession(code!)
    if (!error) return null
    if (/code verifier/i.test(error.message)) {
      return 'This sign-in link was opened in a different browser from the one you requested it in. Type the 6-digit code from the email instead.'
    }
    return `Sign-in link didn’t work: ${error.message}`
  })()
  return redirectResult
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    completeRedirect()
      .then((error) => {
        if (active) setAuthError(error)
        return supabase.auth.getSession()
      })
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Offline, an expired token can't be refreshed; don't treat that as signing out.
      if (!next && event !== 'SIGNED_OUT' && !navigator.onLine) return
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    // Shared devices: drop the offline copy of this account's results and stars.
    // Grades still waiting to upload are kept and sent at the next sign-in.
    removeAll('acct:')
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, authError, clearAuthError: () => setAuthError(null), signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
