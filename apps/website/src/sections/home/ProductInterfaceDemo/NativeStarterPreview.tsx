'use client';

import { useEffect, useRef } from 'react';

import dynamic from 'next/dynamic';

import styles from './NativeStarterPreview.module.css';

// Render the maintained Native Starter itself. No second project model,
// duplicate screens or restyled web dashboard is allowed in this showcase.
const StarterApp = dynamic(
  () =>
    import('./native-starter-source/App').then(
      (module) => module.default
    ),
  { ssr: false }
);

export function NativeStarterPreview() {
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const phone = screenRef.current;
    if (!phone) return;

    // React Native Web renders Modal inside a portal under document.body.
    // Limit only our Select sheets to the visible phone, never the page.
    const styled = new Map<HTMLElement, string | null>();
    let frame = 0;

    const constrainSelectSheets = () => {
      const rect = phone.getBoundingClientRect();
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      const right = Math.min(window.innerWidth, rect.right);
      const bottom = Math.min(window.innerHeight, rect.bottom);

      for (const portal of document.body.children) {
        if (
          !(portal instanceof HTMLElement) ||
          !portal.querySelector('[data-testid="select-content-root"]')
        ) {
          continue;
        }
        const layer = portal.firstElementChild;
        if (!(layer instanceof HTMLElement)) continue;
        if (!styled.has(layer)) {
          styled.set(layer, layer.getAttribute('style'));
        }

        const position = {
          top: top + 'px',
          left: left + 'px',
          right: 'auto',
          bottom: 'auto',
          width: Math.max(0, right - left) + 'px',
          height: Math.max(0, bottom - top) + 'px',
          overflow: 'hidden',
          'border-radius': '32px',
        };
        for (const [property, value] of Object.entries(position)) {
          if (
            layer.style.getPropertyValue(property) !== value ||
            layer.style.getPropertyPriority(property) !== 'important'
          ) {
            layer.style.setProperty(property, value, 'important');
          }
        }
      }
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        constrainSelectSheets();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(phone);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (frame) cancelAnimationFrame(frame);
      for (const [layer, originalStyle] of styled) {
        if (!layer.isConnected) continue;
        if (originalStyle === null) layer.removeAttribute('style');
        else layer.setAttribute('style', originalStyle);
      }
    };
  }, []);

  return (
    <div className={styles.device} aria-label='Vellira Native Starter preview'>
      <div
        ref={screenRef}
        className={styles.screen}
        data-testid='native-starter-preview'
      >
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
