'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Warning } from '@vellira-ui/icons';
import { Button, Select, Tabs } from '@vellira-ui/react';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AppSessionProvider, useAppSession } from './AppSession';

import styles from './AppShell.module.css';

const navigation = [
  { label: 'Home', href: '/app' },
  { label: 'Settings', href: '/app/settings' },
] as const;

type NavigationHref = (typeof navigation)[number]['href'];

function activeHref(pathname: string): NavigationHref {
  return pathname.startsWith('/app/settings') ? '/app/settings' : '/app';
}

function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const value = activeHref(pathname);

  return (
    <>
      <nav className={styles.desktopNavigation} aria-label='Vellira app'>
        <Tabs
          mode='navigation'
          orientation='vertical'
          value={value}
          variant='line'
          className={styles.navigationTabs}
        >
          <Tabs.List>
            {navigation.map((item) => (
              <Tabs.Trigger key={item.href} value={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </Tabs.Trigger>
            ))}
            <Tabs.Indicator />
          </Tabs.List>
        </Tabs>
      </nav>

      <div className={styles.mobileNavigation}>
        <Select
          aria-label='Vellira app section'
          value={value}
          onValueChange={(nextValue) => {
            if (nextValue) {
              router.push(nextValue as NavigationHref);
            }
          }}
          matchTriggerWidth
        >
          {navigation.map((item) => (
            <Select.Item key={item.href} value={item.href}>
              {item.label}
            </Select.Item>
          ))}
        </Select>
      </div>
    </>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { status, me, workspace, error, refresh } = useAppSession();

  if (status === 'loading') {
    return (
      <main className={styles.statusPage}>
        <p role='status'>Loading Vellira…</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={styles.statusPage}>
        <div className={styles.statusContent}>
          <h1>Vellira is temporarily unavailable</h1>
          <p role='alert'>{error}</p>
          <Button onClick={() => void refresh()}>Try again</Button>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
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
          <span className={styles.workspaceName}>{workspace?.name}</span>
          <ThemeSwitcher />
          <Button asChild size='sm' appearance='ghost' color='neutral'>
            <Link href='/app/settings'>Account</Link>
          </Button>
        </div>
      </header>

      {me && !me.emailVerified && (
        <div className={styles.verificationBanner} role='status'>
          <Warning size={20} aria-hidden='true' />
          <div className={styles.verificationCopy}>
            <strong>Email not verified</strong>
            <span>
              Verify your email to finish securing your Vellira account.
            </span>
          </div>
          <Button
            asChild
            size='sm'
            appearance='outline'
            color='neutral'
            className={styles.verificationAction}
          >
            <Link href='/verify-email'>Resend verification email</Link>
          </Button>
        </div>
      )}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <AppNavigation />
        </aside>

        <div className={styles.mobileNavigationRow}>
          <AppNavigation />
        </div>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppSessionProvider>
      <AppShellContent>{children}</AppShellContent>
    </AppSessionProvider>
  );
}

export function AppHome() {
  const { workspace } = useAppSession();

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Vellira App</p>
        <h1>Build consistent product interfaces with Vellira.</h1>
        <p className={styles.lead}>
          Your account is connected. Start with the public Vellira Core today;
          additional product capabilities appear here only when they are ready
          for real use.
        </p>

        <div className={styles.actions}>
          <Button asChild>
            <Link href='/components'>Browse components</Link>
          </Button>
          <Button asChild appearance='outline' color='neutral'>
            <a
              href='https://docs.vellira.dev/start/getting-started'
              target='_blank'
              rel='noreferrer noopener'
            >
              Read the docs
            </a>
          </Button>
        </div>
      </header>

      <section className={styles.section} aria-labelledby='workspace-heading'>
        <div>
          <p className={styles.sectionLabel}>Workspace</p>
          <h2 id='workspace-heading'>{workspace?.name}</h2>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Status</dt>
            <dd>{workspace?.status}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{workspace?.membership.role}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export function SettingsGeneral() {
  const { me, workspace, signOut } = useAppSession();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    await signOut();
    setSigningOut(false);
  };

  return (
    <div className={styles.page}>
      <header className={styles.settingsHeader}>
        <p className={styles.eyebrow}>Settings</p>
        <h1>General</h1>
        <p>
          Review the canonical account and workspace context available to this
          Vellira session.
        </p>
      </header>

      <section
        className={styles.settingsSection}
        aria-labelledby='account-state'
      >
        <h2 id='account-state'>Account</h2>
        <dl className={styles.settingsList}>
          <div>
            <dt>Status</dt>
            <dd>{me?.status}</dd>
          </div>
          <div>
            <dt>Email verification</dt>
            <dd>{me?.emailVerified ? 'Verified' : 'Pending'}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.settingsSection}
        aria-labelledby='workspace-state'
      >
        <h2 id='workspace-state'>Workspace</h2>
        <dl className={styles.settingsList}>
          <div>
            <dt>Name</dt>
            <dd>{workspace?.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{workspace?.status}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{workspace?.membership.role}</dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.settingsSection}
        aria-labelledby='session-state'
      >
        <div>
          <h2 id='session-state'>Session</h2>
          <p>Sign out of this browser session.</p>
        </div>
        <Button
          appearance='outline'
          color='neutral'
          loading={signingOut}
          loadingText='Signing out…'
          onClick={() => void handleSignOut()}
        >
          Sign out
        </Button>
      </section>
    </div>
  );
}
