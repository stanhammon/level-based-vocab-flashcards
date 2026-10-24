import { useSyncExternalStore } from 'react'

/** Whether the browser thinks it has a connection, kept current. */
const subscribeOnline = (l: () => void) => {
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
  }
}
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine)
