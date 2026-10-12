'use client';

import { HeaderMenuButton } from '@/components/layout/HeaderChrome/HeaderMenuButton';

import { useComponentNavigation } from '../ComponentNavigationProvider';

export function ComponentNavigationTrigger() {
  const { open, mainOpen, toggleNavigation, closeMainNavigation } =
    useComponentNavigation();

  return (
    <HeaderMenuButton
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
