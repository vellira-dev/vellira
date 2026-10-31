'use client';

import dynamic from 'next/dynamic';

import styles from './NativeStarterPreview.module.css';

// Render the maintained Native Starter itself. No second project model,
// duplicate screens or restyled web dashboard is allowed in this showcase.
const StarterApp = dynamic(
  () =>
    import('../../../../../../examples/workspace-starter/native/App').then(
      (module) => module.default
    ),
  { ssr: false }
);

export function NativeStarterPreview() {
  return (
    <div className={styles.device} aria-label='Vellira Native Starter preview'>
      <div className={styles.screen} data-testid='native-starter-preview'>
        <div className={styles.island} aria-hidden='true' />
        <div className={styles.statusBar} aria-hidden='true'>
          <span>9:41</span>
          <span>●●● ▰</span>
        </div>
        <div className={styles.appViewport}>
          <StarterApp />
        </div>
      </div>
    </div>
  );
}

NativeStarterPreview.displayName = 'NativeStarterPreview';
