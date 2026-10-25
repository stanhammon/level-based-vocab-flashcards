import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * Service worker updates (SPEC §8). A new version installs in
 * the background and waits; the header offers to apply it, so a deploy never
 * reloads the page in the middle of a session.
 */

let state: 'ready' | 'updating' | null = null
let applyFn: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function startPwa() {
  applyFn = registerSW({
    onNeedRefresh() {
      state = 'ready'
      notify()
    },
  })
}

export function applyUpdate() {
  state = 'updating'
  notify()
  void applyFn?.(true)
  // The page normally reloads as soon as the new version takes over. Some
  // browsers don't report that, so reload anyway after a moment.
  setTimeout(() => window.location.reload(), 3000)
}

const subscribeUpdate = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
/** 'ready' when a new version is waiting, 'updating' once Update is pressed. */
export const useUpdateState = () => useSyncExternalStore(subscribeUpdate, () => state)
