'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CreditCard, Exit, Settings, User } from '@vellira-ui/icons';
import { Button, Dropdown } from '@vellira-ui/react';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAppSession } from './AppSession';

import styles from './AppShell.module.css';

// One canonical product header on /app and on workspace-origin component
// browsing. It uses the same session and account actions in both places.
export function AppHeader({
  mobileAction,
  onAccountNavigate,
}: {
  mobileAction?: ReactNode;
  onAccountNavigate?: () => void;
} = {}) {
  const router = useRouter();
  const { status, workspace, signOut } = useAppSession();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <header className={styles.header} data-product-app-header>
      <Link href='/app' className={styles.brand} aria-label='Vellira home'>
        <Image
          src='/brand/logos/logo-gradient.svg'
          alt='Vellira'
          width={100}
          height={32}
          preload
        />
      </Link>

      <div className={styles.headerContext}>
        <div className={styles.desktopHeaderActions}>
          <ThemeSwitcher />
          {status === 'ready' && (
            <Dropdown color='neutral' placement='bottom-end'>
              <Dropdown.Trigger asChild>
                <Button
                  appearance='ghost'
                  color='neutral'
                  size='sm'
                  iconOnly
                  iconStart={<User size={20} aria-hidden='true' />}
                  aria-label='Account menu'
                />
              </Dropdown.Trigger>
              <Dropdown.Content>
                <Dropdown.Item
                  icon={<Settings size={16} aria-hidden='true' />}
                  onSelect={() => {
                    onAccountNavigate?.();
                    router.push('/app/settings');
                  }}
                >
                  Account settings
                </Dropdown.Item>
                {workspace?.membership.role === 'owner' && (
                  <Dropdown.Item
                    icon={<CreditCard size={16} aria-hidden='true' />}
                    onSelect={() => {
                      onAccountNavigate?.();
                      router.push('/app/settings/billing');
                    }}
                  >
                    Billing
                  </Dropdown.Item>
                )}
                <Dropdown.Separator />
                <Dropdown.Item
                  color='danger'
                  icon={<Exit size={16} aria-hidden='true' />}
                  disabled={signingOut}
                  onSelect={() => {
                    if (signingOut) return;
                    setSigningOut(true);
                    onAccountNavigate?.();
                    void signOut().finally(() => setSigningOut(false));
                  }}
                >
                  Sign out
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown>
          )}
        </div>
        {mobileAction && (
          <div className={styles.mobileHeaderAction}>{mobileAction}</div>
        )}
      </div>
    </header>
  );
}

/** Account actions in the same mobile drawer used by the workspace Sidebar.
 * Presentation comes from the canonical session; backend still authorizes.
 * The theme dropdown remains the existing WebsiteThemeContext-backed control.
 */
export function AppMobileAccountActions({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { status, workspace, signOut } = useAppSession();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className={styles.mobileDrawerAccount}>
      {status === 'ready' && (
        <section className={styles.mobileAccountLinks} aria-label='Account'>
          <h2 className={styles.mobileAccountHeading}>Account</h2>
          <Link
            href='/app/settings'
            className={styles.mobileAccountLink}
            onClick={onNavigate}
          >
            <Settings size={18} aria-hidden='true' />
            <span>Account settings</span>
          </Link>
          {workspace?.membership.role === 'owner' && (
            <Link
              href='/app/settings/billing'
              className={styles.mobileAccountLink}
              onClick={onNavigate}
            >
              <CreditCard size={18} aria-hidden='true' />
              <span>Billing</span>
            </Link>
          )}
          <Button
            appearance='bare'
            type='button'
            className={styles.mobileSignOut}
            disabled={signingOut}
            onClick={() => {
              if (signingOut) return;
              setSigningOut(true);
              onNavigate?.();
              void signOut().finally(() => setSigningOut(false));
            }}
          >
            <Exit size={18} aria-hidden='true' />
            <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </Button>
        </section>
      )}

      <div className={styles.mobileDrawerFooter}>
        <span className={styles.mobileThemeCaption}>Appearance</span>
        <ThemeSwitcher insideModalNavigation />
      </div>
    </div>
  );
}
