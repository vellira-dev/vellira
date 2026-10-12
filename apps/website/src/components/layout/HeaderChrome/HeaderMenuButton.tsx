import { forwardRef } from 'react';

import type { CSSProperties } from 'react';

import { Close, Menu } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

import styles from './HeaderMenuButton.module.css';

/** The identical menu control in SiteHeader, AppHeader and ComponentsHeader.
 * Navigation ownership/open state remains with the existing page context.
 */
export const HeaderMenuButton = forwardRef<
  HTMLButtonElement,
  {
    open: boolean;
    onToggle: () => void;
    controls: string;
    openLabel: string;
    closeLabel: string;
  }
>(({ open, onToggle, controls, openLabel, closeLabel }, ref) => (
  <Button
    ref={ref}
    type='button'
    size='sm'
    appearance='ghost'
    color='neutral'
    shape='square'
    iconOnly
    className={styles.trigger}
    style={{ '--icon-size': '22px' } as CSSProperties}
    aria-label={open ? closeLabel : openLabel}
    aria-expanded={open}
    aria-controls={controls}
    onClick={onToggle}
    iconStart={
      open ? (
        <Close size={22} aria-hidden='true' />
      ) : (
        <Menu size={22} aria-hidden='true' />
      )
    }
  />
));

HeaderMenuButton.displayName = 'HeaderMenuButton';
