'use client';

import { useEffect, useRef } from 'react';

import { HeaderMenuButton } from '@/components/layout/HeaderChrome/HeaderMenuButton';

import { useComponentNavigation } from '../ComponentNavigationProvider';

export function ComponentNavigationTrigger() {
  const { open, mainOpen, toggleNavigation, closeMainNavigation } =
    useComponentNavigation();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A mounted effect proves the mobile trigger has hydrated event handlers.
  // Server-rendered visibility alone is not sufficient for a browser click.
  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    trigger.dataset.componentNavigationHydrated = 'true';
    return () => {
      delete trigger.dataset.componentNavigationHydrated;
    };
  }, []);

  return (
    <HeaderMenuButton
      ref={triggerRef}
      open={open || mainOpen}
      onToggle={mainOpen ? closeMainNavigation : toggleNavigation}
      controls={mainOpen ? 'app-mobile-navigation' : 'component-navigation'}
      openLabel='Open component navigation'
      closeLabel={
        mainOpen ? 'Close workspace navigation' : 'Close component navigation'
      }
    />
  );
}
