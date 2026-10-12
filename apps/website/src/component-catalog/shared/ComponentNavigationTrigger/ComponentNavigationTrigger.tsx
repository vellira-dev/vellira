'use client';

import { HeaderMenuButton } from '@/components/layout/HeaderChrome/HeaderMenuButton';

import { useComponentNavigation } from '../ComponentNavigationProvider';

export function ComponentNavigationTrigger() {
  const { open, toggleNavigation } = useComponentNavigation();

  return (
    <HeaderMenuButton
      open={open}
      onToggle={toggleNavigation}
      controls='component-navigation'
      openLabel='Open component navigation'
      closeLabel='Close component navigation'
    />
  );
}
