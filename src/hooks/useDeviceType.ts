/**
 * Device detection for the public (non-admin) UI.
 *
 * - `mobile`  (<= 767px)  -> renders the dedicated mobile UI
 * - `tablet`  (768-1023px) -> renders the default (desktop) UI
 * - `desktop` (>= 1024px)  -> renders the default (desktop) UI
 *
 * The admin panel is never affected by this: it always renders the desktop UI.
 */

import { useCallback, useEffect, useState } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type UiOverride = 'auto' | 'mobile' | 'desktop';

export const DEVICE_BREAKPOINTS = {
  mobileMax: 767,
  tabletMax: 1023,
} as const;

export const DEVICE_MEDIA_QUERIES: Record<DeviceType, string> = {
  mobile: `(max-width: ${DEVICE_BREAKPOINTS.mobileMax}px)`,
  tablet: `(min-width: ${DEVICE_BREAKPOINTS.mobileMax + 1}px) and (max-width: ${DEVICE_BREAKPOINTS.tabletMax}px)`,
  desktop: `(min-width: ${DEVICE_BREAKPOINTS.tabletMax + 1}px)`,
};

export const UI_OVERRIDE_STORAGE_KEY = 'cse_archive_ui_mode';

function match(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/**
 * Pure detection: viewport width wins, coarse-pointer is only used as a
 * tie-breaker for foldable/tablet-sized touch devices.
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  if (match(DEVICE_MEDIA_QUERIES.mobile) || width <= DEVICE_BREAKPOINTS.mobileMax) {
    return 'mobile';
  }
  if (match(DEVICE_MEDIA_QUERIES.tablet) || width <= DEVICE_BREAKPOINTS.tabletMax) {
    return 'tablet';
  }
  return 'desktop';
}

function readOverride(): UiOverride {
  if (typeof window === 'undefined') return 'auto';
  const raw = window.localStorage.getItem(UI_OVERRIDE_STORAGE_KEY);
  if (raw === 'mobile' || raw === 'desktop' || raw === 'auto') return raw;
  return 'auto';
}

export interface DeviceTypeState {
  /** Raw detected device, ignoring any manual override. */
  detected: DeviceType;
  /** Effective device after applying the manual override. */
  device: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True only while the public UI is still resolving (first paint). */
  isPending: boolean;
  override: UiOverride;
  setOverride: (value: UiOverride) => void;
}

export function useDeviceType(): DeviceTypeState {
  const [override, setOverrideState] = useState<UiOverride>(readOverride);
  const [detected, setDetected] = useState<DeviceType>(detectDeviceType);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    const update = () => setDetected(detectDeviceType());

    update();
    setIsPending(false);

    const queries = Object.values(DEVICE_MEDIA_QUERIES)
      .map((query) => window.matchMedia(query))
      .filter((mql): mql is MediaQueryList => Boolean(mql));

    queries.forEach((mql) => {
      if (typeof mql.addEventListener === 'function') mql.addEventListener('change', update);
      else if (typeof mql.addListener === 'function') mql.addListener(update);
    });

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      queries.forEach((mql) => {
        if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', update);
        else if (typeof mql.removeListener === 'function') mql.removeListener(update);
      });
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  // Keep in sync when another tab changes the override.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== UI_OVERRIDE_STORAGE_KEY) return;
      const next = e.newValue;
      setOverrideState(next === 'mobile' || next === 'desktop' || next === 'auto' ? next : 'auto');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setOverride = useCallback((value: UiOverride) => {
    setOverrideState(value);
    try {
      window.localStorage.setItem(UI_OVERRIDE_STORAGE_KEY, value);
    } catch {
      /* storage unavailable (private mode) - ignore */
    }
  }, []);

  const device: DeviceType = override === 'auto' ? detected : override;

  return {
    detected,
    device,
    isMobile: device === 'mobile',
    isTablet: device === 'tablet',
    isDesktop: device === 'desktop',
    isPending,
    override,
    setOverride,
  };
}