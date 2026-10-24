/**
 * Device storage (SPEC §4.1). Every access is guarded: private windows and
 * blocked site data make localStorage throw or come back empty, and the app
 * must still work with defaults.
 */
const PREFIX = 'lvf:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** Every saved value whose key starts with `prefix`, keyed by the rest of the key. */
export function loadAll<T>(prefix: string): Record<string, T> {
  const out: Record<string, T> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX + prefix)) out[k.slice(PREFIX.length + prefix.length)] = JSON.parse(localStorage.getItem(k)!) as T
    }
  } catch {
    // Storage unavailable.
  }
  return out
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Storage unavailable.
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable: settings just won't be remembered.
  }
}
