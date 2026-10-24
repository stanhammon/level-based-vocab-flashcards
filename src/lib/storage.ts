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

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Storage unavailable: settings just won't be remembered.
  }
}
