'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` saat SSR dan render hidrasi pertama, `true` setelahnya.
 * Dipakai untuk UI yang bergantung pada state persist (localStorage) agar tidak terjadi hydration mismatch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
