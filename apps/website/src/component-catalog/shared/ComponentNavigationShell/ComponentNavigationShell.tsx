'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';

import { HeaderBrand } from '@/components/layout/HeaderChrome/HeaderChrome';
import { trapNavigationTab } from '@/components/navigation/trapNavigationTab';

import { ComponentSidebar } from '../ComponentSidebar';
import { useComponentNavigation } from '../ComponentNavigationProvider';
import { ArrowLeft } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

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
  const { open, closeNavigation, switchToMainNavigation, fromWorkspace } =
    useComponentNavigation();
  const surfaceRef = useRef<HTMLDivElement>(null);

  const closeAndRestoreFocus = useCallback(() => {
    closeNavigation();
    const trigger = document.querySelector<HTMLButtonElement>(
      '[aria-controls="component-navigation"]'
    );
    trigger?.focus();
  }, [closeNavigation]);

  useEffect(() => {
    if (desktopOnly || !open) return;

    // Workspace -> Components replaces the focused workspace link. Give the
    // next drawer an explicit focus target rather than falling back to <body>.
    const primaryAction = surfaceRef.current?.querySelector<HTMLElement>(
      'button[class*="mainNavigationButton"]'
    );
    primaryAction?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }
      trapNavigationTab(event, surfaceRef.current);
    };

    const handleResize = () => {
      if (window.innerWidth <= 1100) return;
      if (surfaceRef.current?.contains(document.activeElement)) {
        document.querySelector<HTMLAnchorElement>(
          'header a[aria-label="Vellira home"]'
        )?.focus();
      }
      closeNavigation();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [closeAndRestoreFocus, desktopOnly, open]);

  return (
    <>
      {!mobileOnly && (
        <div className={styles.desktop}>
          {fromWorkspace && (
            <nav
              className={styles.workspaceReturn}
              aria-label='Workspace navigation'
            >
              <Link href='/app' className={styles.workspaceReturnLink}>
                <ArrowLeft size={16} aria-hidden='true' />
                <span>Back to workspace</span>
              </Link>
            </nav>
          )}
          <div className={styles.desktopList}>
            <ComponentSidebar activeSlug={activeSlug} />
          </div>
        </div>
      )}

      {!desktopOnly && open && (
        <div className={[styles.mobileLayer, styles.mobileLayerOpen].join(' ')}>
          <Button
            appearance='bare'
            type='button'
            className={styles.backdrop}
            aria-label='Close component navigation'
            onClick={closeAndRestoreFocus}
          />

          <div ref={surfaceRef} className={styles.mobileSurface}>
            <div className={styles.mobileHeader}>
              <HeaderBrand
                href={fromWorkspace ? '/app' : '/'}
                className={styles.mobileBrand}
              />
            </div>

            <aside
              id='component-navigation'
              className={styles.mobilePanel}
              aria-label='Component navigation'
            >
              <div className={styles.mainNavigation}>
                {fromWorkspace ? (
                  <Button
                    appearance='bare'
                    type='button'
                    className={styles.mainNavigationButton}
                    onClick={switchToMainNavigation}
                  >
                    <ArrowLeft size={16} aria-hidden='true' />
                    <span>Back to workspace</span>
                  </Button>
                ) : (
                  <Button
                    appearance='bare'
                    type='button'
                    className={styles.mainNavigationButton}
                    onClick={switchToMainNavigation}
                  >
                    <ArrowLeft size={16} aria-hidden='true' />
                    <span>Main navigation</span>
                  </Button>
                )}
              </div>

              <div className={styles.mobilePanelContent}>
                <ComponentSidebar
                  activeSlug={activeSlug}
                  onNavigate={closeNavigation}
                />
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
