'use client';

import {
  readBrowserStorage,
  writeBrowserStorage,
} from '../utils/browserStorage';

import { useEffect, useMemo, useState } from 'react';

export type WebsiteThemePreference =
  'light' | 'dark' | 'system' | 'high-contrast';

export type ResolvedWebsiteTheme = 'light' | 'dark' | 'high-contrast';

const STORAGE_KEY = 'vellira-website-theme';

const isThemePreference = (
  value: string | null
): value is WebsiteThemePreference =>
  value === 'light' ||
  value === 'dark' ||
  value === 'system' ||
  value === 'high-contrast';

export function useWebsiteTheme() {
  const [preference, setPreferenceState] =
    useState<WebsiteThemePreference>('system');

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedPreference = readBrowserStorage('localStorage', STORAGE_KEY);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateSystemTheme = () => {
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    const frame = window.requestAnimationFrame(() => {
      if (isThemePreference(savedPreference)) {
        setPreferenceState(savedPreference);
      }

      updateSystemTheme();
    });

    mediaQuery.addEventListener('change', updateSystemTheme);

    return () => {
      window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener('change', updateSystemTheme);
    };
  }, []);

  const resolvedTheme = useMemo<ResolvedWebsiteTheme>(() => {
    if (preference === 'system') {
      return systemTheme;
    }

    return preference;
  }, [preference, systemTheme]);

  const setPreference = (nextPreference: WebsiteThemePreference) => {
    setPreferenceState(nextPreference);
    writeBrowserStorage('localStorage', STORAGE_KEY, nextPreference);
  };

  return {
    preference,
    resolvedTheme,
    setPreference,
  };
}
