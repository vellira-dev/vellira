'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { User } from '@vellira-ui/icons';
import { Button, Dropdown } from '@vellira-ui/react';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAppSession } from './AppSession';

import styles from './AppShell.module.css';

// One canonical product header on /app and on workspace-origin component
// browsing. It uses the same session and account actions in both places.
export function AppHeader({ mobileAction }: { mobileAction?: ReactNode } = {}) {
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
        {status === 'ready' && workspace && (
          <span className={styles.workspaceName}>{workspace.name}</span>
        )}
        <ThemeSwitcher />
        {mobileAction && (
          <div className={styles.mobileHeaderAction}>{mobileAction}</div>
        )}
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
              <Dropdown.Item onSelect={() => router.push('/app/settings')}>
                Account settings
              </Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item
                color='danger'
                disabled={signingOut}
                onSelect={() => {
                  if (signingOut) return;
                  setSigningOut(true);
                  void signOut().finally(() => setSigningOut(false));
                }}
              >
                Sign out
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
