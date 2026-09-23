'use client'

import { useCallback, useSyncExternalStore } from 'react'

const CHANGED = 'procare-storage-changed'

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

/**
 * A per-device setting kept in localStorage. Read through an external store so
 * the server render and the first client render agree (null), with the stored
 * value arriving straight after — no hydration mismatch, no effect.
 */
export function useStoredValue(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )

  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key)
        else window.localStorage.setItem(key, next)
      } catch {
        // Blocked storage: the choice just won't persist between visits.
      }
      window.dispatchEvent(new Event(CHANGED))
    },
    [key]
  )

  return [value, set]
}
