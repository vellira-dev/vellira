'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import {
  Contrast,
  Error,
  Moon,
  Success,
  Sun,
  System,
  User,
} from '@vellira-ui/icons';
import { Button, Radio, RadioGroup, Tabs } from '@vellira-ui/react';

import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';
import { useAppSession } from './AppSession';
import { BillingPanel } from './BillingSettings';
import { EmailVerificationResend } from './EmailVerificationResend';

import styles from './AccountSettings.module.css';

export type SettingsSection =
  'account' | 'security' | 'workspace' | 'appearance' | 'billing';

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (
    value === 'account' ||
    value === 'security' ||
    value === 'workspace' ||
    value === 'appearance' ||
    value === 'billing'
  );
}

const themeOptions = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: System },
  { value: 'high-contrast', label: 'High contrast', icon: Contrast },
] as const;

function subscribeToDeviceTimeZone() {
  // Timezone is a read-only browser fact until a profile preference API exists.
  return () => {};
}

function readDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unavailable';
}

function readServerTimeZone(): string | null {
  // Keep initial HTML and hydration equal; browser data is resolved afterward.
  return null;
}

function AccountPanel() {
  const { me } = useAppSession();
  const deviceTimeZone = useSyncExternalStore(
    subscribeToDeviceTimeZone,
    readDeviceTimeZone,
    readServerTimeZone
  );

  return (
    <section className={styles.panelContent} aria-labelledby='account-state'>
      <div className={styles.identityRow}>
        <div className={styles.identityIcon} aria-hidden='true'>
          <User size={24} />
        </div>
        <div>
          <h2 id='account-state' className={styles.sectionTitle}>
            Your account
          </h2>
          <p className={styles.description}>
            Your current Vellira account information.
          </p>
        </div>
      </div>

      <dl className={styles.detailList}>
        <div className={styles.detailRow}>
          <dt>Account status</dt>
          <dd>{me?.status ?? 'Unavailable'}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Email verification</dt>
          <dd className={styles.emailVerificationActions}>
            {me ? (
              <span
                className={[
                  styles.verificationStatus,
                  me.emailVerified
                    ? styles.verificationVerified
                    : styles.verificationUnverified,
                ].join(' ')}
              >
                {me.emailVerified ? (
                  <Success size={18} aria-hidden='true' />
                ) : (
                  <Error size={18} aria-hidden='true' />
                )}
                <span>{me.emailVerified ? 'Verified' : 'Not verified'}</span>
              </span>
            ) : (
              'Unavailable'
            )}
            {me && !me.emailVerified && <EmailVerificationResend />}
          </dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Time zone (device)</dt>
          <dd>{deviceTimeZone ?? 'Detecting…'}</dd>
        </div>
      </dl>
      <p className={styles.helper}>
        This time zone is detected from your device, not saved to your Vellira
        account. Workspace details are managed separately under Workspace.
      </p>
    </section>
  );
}

function SecurityPanel() {
  return (
    <section className={styles.panelContent} aria-labelledby='security-state'>
      <div className={styles.sectionIntro}>
        <h2 id='security-state' className={styles.sectionTitle}>
          Security &amp; sign-in
        </h2>
        <p className={styles.description}>
          Recover access to your Vellira account using the existing secure flow.
        </p>
      </div>
      <div className={styles.settingRow}>
        <div className={styles.settingCopy}>
          <h3>Password recovery</h3>
          <p>
            Request a reset link if you need to change or recover your password.
          </p>
        </div>
        <Button appearance='outline' color='neutral' size='sm' asChild>
          <Link href='/forgot-password'>Recover password</Link>
        </Button>
      </div>
    </section>
  );
}

function WorkspacePanel() {
  const { workspace } = useAppSession();

  return (
    <section className={styles.panelContent} aria-labelledby='workspace-state'>
      <div className={styles.sectionIntro}>
        <h2 id='workspace-state' className={styles.sectionTitle}>
          Workspace
        </h2>
        <p className={styles.description}>
          Details about the workspace attached to your current session.
        </p>
      </div>
      <dl className={styles.detailList}>
        <div className={styles.detailRow}>
          <dt>Name</dt>
          <dd>{workspace?.name ?? 'Unavailable'}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Membership</dt>
          <dd>{workspace?.membership.role ?? 'Unavailable'}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Status</dt>
          <dd>{workspace?.status ?? 'Unavailable'}</dd>
        </div>
      </dl>
      <p className={styles.helper}>
        Your workspace role is separate from subscription and product access.
      </p>
    </section>
  );
}

function AppearancePanel() {
  const { preference, setPreference } = useWebsiteThemeContext();

  return (
    <section className={styles.panelContent} aria-labelledby='appearance-state'>
      <div className={styles.sectionIntro}>
        <h2 id='appearance-state' className={styles.sectionTitle}>
          Appearance
        </h2>
        <p className={styles.description}>
          Choose how Vellira looks on this device.
        </p>
      </div>
      <RadioGroup
        label='Theme'
        orientation='horizontal'
        value={preference}
        onValueChange={(value) => {
          if (
            value === 'light' ||
            value === 'dark' ||
            value === 'system' ||
            value === 'high-contrast'
          ) {
            setPreference(value);
          }
        }}
        className={styles.themeGroup}
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <Radio
            key={value}
            value={value}
            wrapperClassName={styles.themeChoice}
            label={
              <span className={styles.themeLabel}>
                <Icon size={20} aria-hidden='true' />
                <span>{label}</span>
              </span>
            }
          />
        ))}
      </RadioGroup>
    </section>
  );
}

export function SettingsGeneral({
  section = 'account',
}: {
  section?: SettingsSection;
}) {
  const router = useRouter();
  const { workspace } = useAppSession();
  const isOwner = workspace?.membership.role === 'owner';
  const billingDenied = section === 'billing' && !isOwner;
  const activeSection = billingDenied ? 'account' : section;

  return (
    <div className={styles.root} data-account-settings>
      <header className={styles.pageHeader}>
        <h1>Settings</h1>
        <p>Manage your account, security and preferences.</p>
      </header>

      {billingDenied && (
        <p role='alert' className={styles.permissionNotice}>
          Billing information is available to authorized workspace owners only.
        </p>
      )}

      <Tabs
        mode='tabs'
        variant='line'
        size='sm'
        value={activeSection}
        onValueChange={(next) => {
          if (!isSettingsSection(next) || (next === 'billing' && !isOwner)) {
            return;
          }
          router.push(
            next === 'billing'
              ? '/app/settings/billing'
              : `/app/settings?section=${next}`,
            { scroll: false }
          );
        }}
        className={styles.tabs}
      >
        <Tabs.List aria-label='Account settings sections' scrollable>
          <Tabs.Trigger value='account'>Account</Tabs.Trigger>
          <Tabs.Trigger value='security'>Security</Tabs.Trigger>
          <Tabs.Trigger value='workspace'>Workspace</Tabs.Trigger>
          <Tabs.Trigger value='appearance'>Appearance</Tabs.Trigger>
          {isOwner && <Tabs.Trigger value='billing'>Billing</Tabs.Trigger>}
          <Tabs.Indicator />
        </Tabs.List>

        <Tabs.Content value='account'>
          <AccountPanel />
        </Tabs.Content>
        <Tabs.Content value='security'>
          <SecurityPanel />
        </Tabs.Content>
        <Tabs.Content value='workspace'>
          <WorkspacePanel />
        </Tabs.Content>
        <Tabs.Content value='appearance'>
          <AppearancePanel />
        </Tabs.Content>
        {isOwner && (
          <Tabs.Content value='billing'>
            <BillingPanel />
          </Tabs.Content>
        )}
      </Tabs>
    </div>
  );
}
