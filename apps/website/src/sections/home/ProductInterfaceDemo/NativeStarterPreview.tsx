'use client';

import styles from './NativeStarterPreview.module.css';

// The canonical Native Starter runs in a same-origin browser viewport.
// React Native Web portals (Select, Modal, etc.) must stay inside the device,
// never escape to the containing marketing page.
export function NativeStarterPreview() {
  return (
    <div className={styles.device} aria-label='Vellira Native Starter preview'>
      <div className={styles.screen} data-testid='native-starter-preview'>
        <div className={styles.island} aria-hidden='true' />
        <div className={styles.statusBar} aria-hidden='true'>
          <span>9:41</span>
          <span>●●● ▰</span>
        </div>
        <iframe
          className={styles.appViewport}
          title='Interactive Vellira Native Starter'
          src='/demo/native-starter'
          loading='eager'
          data-testid='native-starter-iframe'
        />
      </div>
    </div>
  );
}

NativeStarterPreview.displayName = 'NativeStarterPreview';
