'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Warning, Grid, Platforms, Docs, ChevronLeft, ChevronRight, Menu, Close } from '@vellira-ui/icons';
import { Button, Portal, Tooltip } from '@vellira-ui/react';
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/navigation/Sidebar';

import { AppSessionProvider, useAppSession } from './AppSession';
import { AppHeader } from './AppHeader';
import { EmailVerificationResend } from './EmailVerificationResend';

import styles from './AppShell.module.css';

function activeHref(pathname: string) {
  return pathname.startsWith('/app/settings') ? '/app/settings' : '/app';
}

function AppNavigation({
  collapsed,
  navigationId,
  mobile = false,
  onNavigate,
}: {
  collapsed: boolean;
  navigationId?: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const value = activeHref(pathname);

  return (
    <nav
      id={navigationId}
      className={mobile ? styles.drawerNavigation : styles.desktopNavigation}
      aria-label={mobile ? 'Mobile workspace navigation' : 'Vellira app'}
    >
        <Sidebar ariaLabel='Account navigation'>
          <SidebarGroup label='Workspace'>
            <SidebarItem active={value === '/app'}>
              <Tooltip placement='right' disabled={!collapsed}><Tooltip.Trigger asChild><Link href='/app' onClick={onNavigate} aria-label={collapsed ? 'Overview' : undefined} aria-current={value === '/app' ? 'page' : undefined}>
                <span className={styles.navEntry}><Grid size={18} aria-hidden='true' /><span className={styles.navLabel}>Overview</span></span>
              </Link></Tooltip.Trigger><Portal><Tooltip.Content>Overview</Tooltip.Content></Portal></Tooltip>
            </SidebarItem>
            <SidebarItem>
              <Tooltip placement='right' disabled={!collapsed}>
                <Tooltip.Trigger asChild>
                  <Link
                    href='/components?from=app'
                    onClick={onNavigate}
                    aria-label={collapsed ? 'Components' : undefined}
                  >
                    <span className={styles.navEntry}>
                      <Platforms size={18} aria-hidden='true' />
                      <span className={styles.navLabel}>Components</span>
                    </span>
                    <ChevronRight className={styles.navTrailing} size={16} aria-hidden='true' />
                  </Link>
                </Tooltip.Trigger>
                <Portal>
                  <Tooltip.Content>Components</Tooltip.Content>
                </Portal>
              </Tooltip>
            </SidebarItem>
          </SidebarGroup>
          <SidebarGroup label='Resources'>
            <SidebarItem>
              <Tooltip placement='right' disabled={!collapsed}><Tooltip.Trigger asChild><a aria-label={collapsed ? 'Docs' : undefined} href='https://docs.vellira.dev/start/getting-started' target='_blank' rel='noopener noreferrer' onClick={onNavigate}>
                <span className={styles.navEntry}><Docs size={18} aria-hidden='true' /><span className={styles.navLabel}>Docs ↗</span></span>
              </a></Tooltip.Trigger><Portal><Tooltip.Content>Docs</Tooltip.Content></Portal></Tooltip>
            </SidebarItem>
          </SidebarGroup>
        </Sidebar>
    </nav>

  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { status, me, error, refresh } = useAppSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
      <AppHeader />

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
          </div>
          <EmailVerificationResend className={styles.verificationAction} />
        </div>
      )}

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <AppNavigation collapsed={sidebarCollapsed} navigationId='app-sidebar-navigation' />
          <div className={styles.sidebarToggleRow}>
            <Button
              appearance='bare'
              color='neutral'
              size='sm'
              className={styles.sidebarToggleButton}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-controls='app-sidebar-navigation'
              aria-expanded={!sidebarCollapsed}
              onClick={() => setSidebarCollapsed((previous) => !previous)}
            >
              <span className={styles.navEntry}>
                {sidebarCollapsed ? (
                  <ChevronRight size={18} aria-hidden='true' />
                ) : (
                  <ChevronLeft size={18} aria-hidden='true' />
                )}
                <span className={styles.toggleLabel}>Collapse sidebar</span>
              </span>
            </Button>
          </div>
        </aside>

        <div className={styles.mobileNavigationRow}>
          <AppNavigation collapsed={false} />
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
          <Link href='/components?from=app' className={styles.resourceLink}>
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

