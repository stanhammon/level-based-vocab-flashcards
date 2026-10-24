import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker updates (SPEC §8). A new version installs in
 * the background and waits; the header offers to apply it, so a deploy never
 * reloads the page in the middle of a session.
 */

let updateReady = false
let applyFn: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function startPwa() {
  applyFn = registerSW({
    onNeedRefresh() {
      updateReady = true
      notify()
    },
  })
}

export function applyUpdate() {
  void applyFn?.(true)
}

const subscribeUpdate = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useUpdateReady = () => useSyncExternalStore(subscribeUpdate, () => updateReady)
