'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Warning,
  Grid,
  Platforms,
  Docs,
  ChevronLeft,
  ChevronRight,
} from '@vellira-ui/icons';
import { Button, Portal, Tooltip } from '@vellira-ui/react';
import {
  Sidebar,
  SidebarGroup,
  SidebarItem,
} from '@/components/navigation/Sidebar';
import { HeaderBrand } from '@/components/layout/HeaderChrome/HeaderChrome';
import { HeaderMenuButton } from '@/components/layout/HeaderChrome/HeaderMenuButton';

import { AppSessionProvider, useAppSession } from './AppSession';
import { AppHeader, AppMobileAccountActions } from './AppHeader';
import { EmailVerificationResend } from './EmailVerificationResend';

import styles from './AppShell.module.css';
import componentDrawerStyles from '@/component-catalog/shared/ComponentNavigationShell/ComponentNavigationShell.module.css';

function activeHref(pathname: string) {
  return pathname.startsWith('/app/settings') ? '/app/settings' : '/app';
}

/** A disabled Tooltip.Trigger would disable its asChild Link.
 * Expanded navigation must render a plain accessible link; only the collapsed
 * icon rail needs the tooltip.
 */
function CollapsedNavTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  if (!collapsed) return <>{children}</>;

  return (
    <Tooltip placement='right'>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Portal>
    </Tooltip>
  );
}

function AppNavigation({
  collapsed,
  navigationId,
  mobile = false,
  onNavigate,
  onComponentsSwitch,
}: {
  collapsed: boolean;
  navigationId?: string;
  mobile?: boolean;
  onNavigate?: () => void;
  onComponentsSwitch?: () => void;
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
            <CollapsedNavTooltip collapsed={collapsed} label='Overview'>
              <Link
                href='/app'
                onClick={onNavigate}
                aria-label={collapsed ? 'Overview' : undefined}
                aria-current={value === '/app' ? 'page' : undefined}
              >
                <span className={styles.navEntry}>
                  <Grid size={18} aria-hidden='true' />
                  <span className={styles.navLabel}>Overview</span>
                </span>
              </Link>
            </CollapsedNavTooltip>
          </SidebarItem>
          <SidebarItem>
            <CollapsedNavTooltip collapsed={collapsed} label='Components'>
              <Link
                href='/components?from=app'
                onClick={(event) => {
                  if (onComponentsSwitch) {
                    event.preventDefault();
                    onComponentsSwitch();
                  } else {
                    onNavigate?.();
                  }
                }}
                aria-label={collapsed ? 'Components' : undefined}
              >
                <span className={styles.navEntry}>
                  <Platforms size={18} aria-hidden='true' />
                  <span className={styles.navLabel}>Components</span>
                </span>
                <ChevronRight
                  className={styles.navTrailing}
                  size={16}
                  aria-hidden='true'
                />
              </Link>
            </CollapsedNavTooltip>
          </SidebarItem>
        </SidebarGroup>
        <SidebarGroup label='Resources'>
          <SidebarItem>
            <CollapsedNavTooltip collapsed={collapsed} label='Docs'>
              <a
                href='https://docs.vellira.dev/start/getting-started'
                target='_blank'
                rel='noopener noreferrer'
                onClick={onNavigate}
                aria-label={collapsed ? 'Docs' : undefined}
              >
                <span className={styles.navEntry}>
                  <Docs size={18} aria-hidden='true' />
                  <span className={styles.navLabel}>Docs ↗</span>
                </span>
              </a>
            </CollapsedNavTooltip>
          </SidebarItem>
        </SidebarGroup>
      </Sidebar>
    </nav>
  );
}

/** The canonical authenticated mobile navigation overlay, shared by /app
 * and Components opened from the workspace. Changing between the component
 * drawer and this drawer never requires navigating to another page.
 */
export function AppWorkspaceMobileMenu({
  open,
  onClose,
  triggerRef,
  onComponentsSwitch,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  onComponentsSwitch?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  const focusTrigger = useCallback(() => {
    const trigger =
      triggerRef?.current ??
      document.querySelector<HTMLButtonElement>(
        '[aria-controls="app-mobile-navigation"]'
      );
    trigger?.focus();
  }, [triggerRef]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a[href]')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        focusTrigger();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        ) ?? []
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleResize = () => {
      if (window.innerWidth > 1100) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, onClose, focusTrigger]);

  if (!open) return null;

  return (
    <div
      className={[
        componentDrawerStyles.mobileLayer,
        componentDrawerStyles.mobileLayerOpen,
      ].join(' ')}
    >
      <Button
        appearance='bare'
        type='button'
        className={componentDrawerStyles.backdrop}
        aria-label='Dismiss workspace navigation'
        onClick={() => {
          onClose();
          focusTrigger();
        }}
      />
      <div
        ref={panelRef}
        id='app-mobile-navigation'
        className={componentDrawerStyles.mobileSurface}
        role='dialog'
        aria-modal='true'
        aria-label='Workspace navigation'
      >
        <div className={componentDrawerStyles.mobileHeader}>
          <HeaderBrand
            href='/app'
            className={componentDrawerStyles.mobileBrand}
            ariaLabel='Vellira workspace'
            onClick={onClose}
          />
        </div>
        <div className={componentDrawerStyles.mobilePanel}>
          <div className={componentDrawerStyles.mobilePanelContent}>
            <AppNavigation
              collapsed={false}
              mobile
              onNavigate={onClose}
              onComponentsSwitch={onComponentsSwitch}
            />
          </div>
          <div className={styles.mobileAccountFooter}>
            <AppMobileAccountActions onNavigate={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppShellContent({ children }: { children: ReactNode }) {
  const { status, me, error, refresh } = useAppSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

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
    <div
      className={styles.shell}
      data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'}
    >
      <AppHeader
        onAccountNavigate={closeMobileMenu}
        mobileAction={
          <HeaderMenuButton
            ref={mobileMenuTriggerRef}
            open={mobileMenuOpen}
            onToggle={() => setMobileMenuOpen((current) => !current)}
            controls='app-mobile-navigation'
            openLabel='Open workspace navigation'
            closeLabel='Close workspace navigation'
          />
        }
      />
      <AppWorkspaceMobileMenu
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        triggerRef={mobileMenuTriggerRef}
      />

      {process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW === '1' && (
          <div className={styles.verificationBanner} role='status'>
            Local UI preview — sample account data. No backend session or real
            account actions.
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

      <div className={styles.body} inert={mobileMenuOpen}>
        <aside className={styles.sidebar}>
          <AppNavigation
            collapsed={sidebarCollapsed}
            navigationId='app-sidebar-navigation'
          />
          <div className={styles.sidebarToggleRow}>
            <Button
              appearance='bare'
              color='neutral'
              size='sm'
              className={styles.sidebarToggleButton}
              aria-label={
                sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
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

      <section
        className={styles.startPanel}
        aria-labelledby='getting-started-heading'
      >
        <h2 id='getting-started-heading'>Get started</h2>
        <div className={styles.resourceList}>
          <Link href='/components?from=app' className={styles.resourceLink}>
            <span aria-hidden='true' className={styles.resourceIcon}>
              ◎
            </span>
            <span>Explore the component library</span>
            <span aria-hidden='true' className={styles.resourceArrow}>
              ↗
            </span>
          </Link>
          <a
            href='https://docs.vellira.dev/start/getting-started'
            className={styles.resourceLink}
            target='_blank'
            rel='noopener noreferrer'
          >
            <span aria-hidden='true' className={styles.resourceIcon}>
              ›_
            </span>
            <span>Install Vellira Core</span>
            <span aria-hidden='true' className={styles.resourceArrow}>
              ↗
            </span>
          </a>
          <a
            href='https://docs.vellira.dev/start/getting-started'
            className={styles.resourceLink}
            target='_blank'
            rel='noopener noreferrer'
          >
            <span aria-hidden='true' className={styles.resourceIcon}>
              ▤
            </span>
            <span>Follow the getting-started guide</span>
            <span aria-hidden='true' className={styles.resourceArrow}>
              ↗
            </span>
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
