'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

import { ComponentSidebar } from '../ComponentSidebar';
import { useComponentNavigation } from '../ComponentNavigationProvider';
import { ArrowLeft } from '@vellira-ui/icons';

import styles from './ComponentNavigationShell.module.css';

type ComponentNavigationShellProps = {
  activeSlug?: string;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
};

export function ComponentNavigationShell({
  activeSlug,
  mobileOnly = false,
  desktopOnly = false,
}: ComponentNavigationShellProps) {
  const { open, closeNavigation, switchToMainNavigation } =
    useComponentNavigation();

  useEffect(() => {
    if (desktopOnly || !open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNavigation();
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeNavigation, desktopOnly, open]);

  return (
    <>
      {!mobileOnly && (
        <div className={styles.desktop}>
          <ComponentSidebar activeSlug={activeSlug} />
        </div>
      )}

      {!desktopOnly && open && (
        <div className={[styles.mobileLayer, styles.mobileLayerOpen].join(' ')}>
          <button
            type='button'
            className={styles.backdrop}
            aria-label='Close component navigation'
            onClick={closeNavigation}
          />

          <div className={styles.mobileSurface}>
            <div className={styles.mobileHeader}>
              <Link href='/' className={styles.mobileBrand}>
                <Image
                  src='/brand/logos/logo-gradient.svg'
                  alt='Vellira'
                  width={100}
                  height={32}
                  preload
                  fetchPriority='high'
                />
              </Link>
            </div>

            <aside
              id='component-navigation'
              className={styles.mobilePanel}
              aria-label='Component navigation'
            >
              <div className={styles.mainNavigation}>
                <button
                  type='button'
                  className={styles.mainNavigationButton}
                  onClick={switchToMainNavigation}
                >
                  <ArrowLeft size={16} aria-hidden='true' />
                  <span>Main navigation</span>
                </button>
              </div>

              <div className={styles.mobilePanelContent}>
                <ComponentSidebar activeSlug={activeSlug} />
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
