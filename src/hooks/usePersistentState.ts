/**
 * Persisted UI state.
 *
 * Tab and view selections used to reset on every navigation, so an admin who
 * switched the analytics view to "Searches" lost that every time they moved
 * between admin sections, and switching grid/list on the public directory reset
 * on refresh. `usePersistentState` keeps a value in localStorage so the UI comes
 * back exactly as it was left.
 *
 * Reads are lazy (only on first render) and writes are guarded, so a corrupt or
 * hand-edited value can never crash the app — it just falls back to the default.
 */

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'cse_archive_ui_';

/**
 * Narrows a stored string to a known union without trusting it.
 * Used so an invalid persisted value degrades to the default instead of
 * poisoning downstream comparisons.
 */
function coerce<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  const hit = allowed.find((option) => option === raw);
  return hit ?? fallback;
}

/**
 * A `useState` that survives reloads and navigation.
 *
 * @param key    Storage suffix, namespaced automatically.
 * @param allowed Permitted values. Anything else is ignored on read.
 * @param fallback Value used when nothing valid is stored.
 */
export function usePersistentState<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const storageKey = PREFIX + key;

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback;
    try {
      return coerce<T>(window.localStorage.getItem(storageKey), allowed, fallback);
    } catch {
      // Private-mode / disabled storage.
      return fallback;
    }
  });

  const setPersisted = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Non-fatal: the in-memory value still applies for this session.
      }
    },
    [storageKey]
  );

  // Keep multiple tabs of the admin panel in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      const incoming = e.newValue;
      setValue(incoming === null ? fallback : coerce<T>(incoming, allowed, fallback));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, fallback, allowed]);

  return [value, setPersisted];
}
