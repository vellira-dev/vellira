'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Warning, User, Grid, Platforms, Docs, ChevronLeft, ChevronRight } from '@vellira-ui/icons';
import { Button, Dropdown, Portal, Select, Tooltip } from '@vellira-ui/react';
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/navigation/Sidebar';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { AppSessionProvider, useAppSession } from './AppSession';
import { resendCurrentVerification, VelliraApiError } from './api';

import styles from './AppShell.module.css';

const navigation = [
  { label: 'Overview', href: '/app' },
  { label: 'Settings', href: '/app/settings' },
] as const;

type NavigationHref = (typeof navigation)[number]['href'];

function activeHref(pathname: string): NavigationHref {
  return pathname.startsWith('/app/settings') ? '/app/settings' : '/app';
}

function AppNavigation({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const value = activeHref(pathname);

  return (
    <>
      <nav className={styles.desktopNavigation} aria-label='Vellira app'>
        <Sidebar ariaLabel='Account navigation'>
          <SidebarGroup label={collapsed ? '' : 'Workspace'}>
            <SidebarItem active={value === '/app'}>
              <Tooltip placement='right' disabled={!collapsed}><Tooltip.Trigger asChild><Link href='/app' aria-label={collapsed ? 'Overview' : undefined} aria-current={value === '/app' ? 'page' : undefined}>
                <span className={styles.navEntry}><Grid size={18} aria-hidden='true' />{!collapsed && <span>Overview</span>}</span>
              </Link></Tooltip.Trigger><Portal><Tooltip.Content>Overview</Tooltip.Content></Portal></Tooltip>
            </SidebarItem>
          </SidebarGroup>
          <SidebarGroup label={collapsed ? '' : 'Resources'}>
            <SidebarItem>
              <Tooltip placement='right' disabled={!collapsed}><Tooltip.Trigger asChild><Link href='/components' aria-label={collapsed ? 'Components' : undefined}>
                <span className={styles.navEntry}><Platforms size={18} aria-hidden='true' />{!collapsed && <span>Components ↗</span>}</span>
              </Link></Tooltip.Trigger><Portal><Tooltip.Content>Components</Tooltip.Content></Portal></Tooltip>
            </SidebarItem>
            <SidebarItem>
              <Tooltip placement='right' disabled={!collapsed}><Tooltip.Trigger asChild><a aria-label={collapsed ? 'Docs' : undefined} href='https://docs.vellira.dev/start/getting-started' target='_blank' rel='noopener noreferrer'>
                <span className={styles.navEntry}><Docs size={18} aria-hidden='true' />{!collapsed && <span>Docs ↗</span>}</span>
              </a></Tooltip.Trigger><Portal><Tooltip.Content>Docs</Tooltip.Content></Portal></Tooltip>
            </SidebarItem>
          </SidebarGroup>
        </Sidebar>
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
  const { status, me, workspace, error, refresh, signOut } = useAppSession();
  const router = useRouter();
  const [resendingVerification, setResendingVerification] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<string>();
  const [verificationError, setVerificationError] = useState<string>();

  const handleVerificationResend = async () => {
    if (resendingVerification) return;

    setResendingVerification(true);
    setVerificationMessage(undefined);
    setVerificationError(undefined);

    try {
      await resendCurrentVerification();
      setVerificationMessage(
        'If verification is still needed, check your inbox for a new verification email.'
      );
      await refresh();
    } catch (cause) {
      setVerificationError(
        cause instanceof VelliraApiError && cause.code === 'rate_limited'
          ? 'Too many requests. Please try again shortly.'
          : 'Verification email is temporarily unavailable. Please try again.'
      );
    } finally {
      setResendingVerification(false);
    }
  };

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
    <div className={styles.shell} data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}>
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
        </div>
      </header>

      {process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW === '1' && (
          <div className={styles.verificationBanner} role='status'>
            Local UI preview — sample account data. No backend session or real account actions.
          </div>
        )}

      {me && !me.emailVerified && (
        <div className={styles.verificationBanner} role='status'>
          <Warning size={20} aria-hidden='true' />
          <div className={styles.verificationCopy}>
            <strong>Email not verified</strong>
            <span>
              Verify your email to finish securing your Vellira account.
            </span>
            {verificationMessage && (
              <span className={styles.verificationStatus} role='status'>
                {verificationMessage}
              </span>
            )}
            {verificationError && (
              <span className={styles.verificationError} role='alert'>
                {verificationError}
              </span>
            )}
          </div>
          <Button
            size='sm'
            appearance='outline'
            color='neutral'
            className={styles.verificationAction}
            loading={resendingVerification}
            loadingText='Sending…'
            disabled={resendingVerification}
            onClick={() => void handleVerificationResend()}
          >
            Resend verification email
          </Button>
        </div>
      )}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <AppNavigation collapsed={sidebarCollapsed} />
          <div className={styles.sidebarToggleRow}>
            <Button
              appearance='ghost'
              color='neutral'
              size='sm'
              iconStart={sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              iconOnly={sidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((previous) => !previous)}
            >
              {!sidebarCollapsed && 'Collapse sidebar'}
            </Button>
          </div>
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
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Your workspace · Get started</p>
        <h1>Start building with Vellira</h1>
        <p className={styles.lead}>Your cross-platform UI foundation.</p>
      </header>

      <section className={styles.startPanel} aria-labelledby='getting-started-heading'>
        <h2 id='getting-started-heading'>Get started</h2>
        <div className={styles.resourceList}>
          <Link href='/components' className={styles.resourceLink}>
            <span aria-hidden='true' className={styles.resourceIcon}>◎</span>
            <span>Explore the component library</span>
            <span aria-hidden='true' className={styles.resourceArrow}>↗</span>
          </Link>
          <a
            href='https://docs.vellira.dev/start/getting-started'
            className={styles.resourceLink}
            target='_blank'
            rel='noopener noreferrer'
          >
            <span aria-hidden='true' className={styles.resourceIcon}>›_</span>
            <span>Install Vellira Core</span>
            <span aria-hidden='true' className={styles.resourceArrow}>↗</span>
          </a>
          <a
            href='https://docs.vellira.dev/start/getting-started'
            className={styles.resourceLink}
            target='_blank'
            rel='noopener noreferrer'
          >
            <span aria-hidden='true' className={styles.resourceIcon}>▤</span>
            <span>Follow the getting-started guide</span>
            <span aria-hidden='true' className={styles.resourceArrow}>↗</span>
          </a>
        </div>
      </section>
      <section className={styles.proNote} aria-label='Additional workflows'>
        <h2>Build more with Pro</h2>
        <p>Discover advanced UI production workflows when available.</p>
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
        <h1>Account settings</h1>
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

      <section className={styles.settingsSection} aria-labelledby='security-state'>
        <div>
          <h2 id='security-state'>Security &amp; sign-in</h2>
          <p>Use the existing password recovery flow if you need to regain access to your account.</p>
        </div>
        <Button asChild appearance='outline' color='neutral'>
          <Link href='/forgot-password'>Password recovery</Link>
        </Button>
      </section>

      <section className={styles.settingsSection} aria-labelledby='appearance-state'>
        <div>
          <h2 id='appearance-state'>Appearance</h2>
          <p>Change between light, dark and system appearance using the theme control in the header.</p>
        </div>
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
