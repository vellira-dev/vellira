'use client';

import dynamic from 'next/dynamic';

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
  return (
    <main className={styles.viewport} aria-label='Native Starter demo'>
      <StarterApp />
    </main>
  );
}
