'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import styles from './page.module.css';

// Render the exact source-synchronized Expo Starter, isolated inside the
// phone iframe so React Native Web Modal portals use the device viewport.
const StarterApp = dynamic(
  () =>
    import('@/sections/home/ProductInterfaceDemo/native-starter-source/App').then(
      (module) => module.default
    ),
  { ssr: false }
);

export default function NativeStarterFramePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Browser-only showcase bridge. The canonical Expo Starter is unchanged.
    // Prime its isolated demo storage before App reads the saved theme.
    const requested = new URLSearchParams(window.location.search).get('websiteTheme');
    const nativeTheme =
      requested === 'dark'
        ? 'dark'
        : requested === 'high-contrast'
          ? 'highContrast'
          : 'light';
    try {
      window.localStorage.setItem(
        'vellira-native-showcase:vellira-workspace-native-theme-v1',
        nativeTheme
      );
    } catch {
      // Private browsing may deny storage; App remains usable with its default.
    }
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <main className={styles.viewport} aria-label='Native Starter demo'>
      <StarterApp />
    </main>
  );
}
