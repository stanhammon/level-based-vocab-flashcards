import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Without Supabase settings the app still quizzes; sign-in is just hidden. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Same project as SafeOrder (SPEC §4.2). A placeholder client keeps imports
// working when env is missing.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // Sign-in redirects are completed in auth.tsx so errors can be shown.
    detectSessionInUrl: false,
  },
})

/** Turn a Supabase/Postgres error into something worth showing a person. */
export function errorMessage(error: unknown): string {
  if (!error) return 'Something went wrong'
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string }
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(e.message ?? '')) {
      return 'You’re offline. Try again when you have a connection.'
    }
    if (e.message) return e.message
  }
  return String(error)
}
