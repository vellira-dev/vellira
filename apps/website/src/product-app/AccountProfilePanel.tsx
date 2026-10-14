'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';

import { Check, Error, Success, User } from '@vellira-ui/icons';
import { Button, Input, Select } from '@vellira-ui/react';

import {
  getAccountProfile,
  saveAccountProfile,
  VelliraApiError,
  type AccountProfile,
  type AccountProfileChanges,
} from './api';
import { localAccountPreview, useAppSession } from './AppSession';
import { EmailVerificationResend } from './EmailVerificationResend';

import styles from './AccountProfilePanel.module.css';

type ReadyProfile = {
  kind: 'ready';
  userId: string;
  attempt: number;
  original: AccountProfile;
  draft: AccountProfileChanges;
  saveState: 'idle' | 'saving' | 'saved' | 'preview-saved' | 'conflict' | 'error';
};
type ProfileState =
  { kind: 'loading' | 'error'; userId: string; attempt: number } | ReadyProfile;

const previewProfile: AccountProfile = {
  fullName: 'Alex Morgan',
  displayName: 'Alex',
  locale: 'en',
  timeZone: 'Europe/Paris',
  revision: 1,
};

const timeZones = [
  'UTC',
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Tokyo',
] as const;

function subscribeToDeviceTimeZone() {
  return () => {};
}

function readDeviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unavailable';
}

function readServerTimeZone(): string | null {
  return null;
}

function profileFields(value: AccountProfile): AccountProfileChanges {
  return {
    fullName: value.fullName,
    displayName: value.displayName,
    locale: value.locale,
    timeZone: value.timeZone,
  };
}

function equalFields(a: AccountProfileChanges, b: AccountProfileChanges) {
  return (
    a.fullName === b.fullName &&
    a.displayName === b.displayName &&
    a.locale === b.locale &&
    a.timeZone === b.timeZone
  );
}

function validateName(value: string, limit: number) {
  if (value !== value.trim()) return 'Remove leading or trailing whitespace.';
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value))
    return 'Remove unsupported control characters.';
  if (Array.from(value).length > limit)
    return 'Use ' + limit + ' characters or fewer.';
  return undefined;
}

function initials(value: string) {
  const tokens = value.trim().split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) return '';
  return (
    tokens[0][0] + (tokens.length > 1 ? tokens[tokens.length - 1][0] : '')
  ).toLocaleUpperCase();
}

export function AccountProfilePanel({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { me, status } = useAppSession();
  const userId = me?.id ?? '';
  const deviceTimeZone = useSyncExternalStore(
    subscribeToDeviceTimeZone,
    readDeviceTimeZone,
    readServerTimeZone
  );
  const [attempt, setAttempt] = useState(0);
  const [stored, setStored] = useState<ProfileState>({
    kind: 'loading',
    userId: '',
    attempt: 0,
  });
  const savingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready' || !userId) return;

    if (localAccountPreview) {
      setStored({
        kind: 'ready',
        userId,
        attempt,
        original: previewProfile,
        draft: profileFields(previewProfile),
        saveState: 'idle',
      });
      return;
    }

    const abort = new AbortController();
    void getAccountProfile(abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setStored({
            kind: 'ready',
            userId,
            attempt,
            original: result,
            draft: profileFields(result),
            saveState: 'idle',
          });
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setStored({ kind: 'error', userId, attempt });
        }
      });

    return () => abort.abort();
  }, [userId, status, attempt]);

  // A change of authenticated principal must never paint the previous user's
  // cached profile even for one frame. Do not reset it via a passive effect.
  const visible: ProfileState =
    status === 'ready' &&
    !!userId &&
    stored.userId === userId &&
    stored.attempt === attempt
      ? stored
      : { kind: 'loading', userId, attempt };

  const profile = visible.kind === 'ready' ? visible : null;
  const dirty =
    !!profile && !equalFields(profile.draft, profileFields(profile.original));
  const fullNameError = profile
    ? validateName(profile.draft.fullName, 120)
    : undefined;
  const displayNameError = profile
    ? validateName(profile.draft.displayName, 60)
    : undefined;
  const saving = profile?.saveState === 'saving';
  const maySave =
    !!profile &&
    dirty &&
    !fullNameError &&
    !displayNameError &&
    !saving;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const change = (key: keyof AccountProfileChanges, value: string) => {
    setStored((old) => {
      if (
        old.kind !== 'ready' ||
        old.userId !== userId ||
        old.attempt !== attempt ||
        old.saveState === 'saving'
      )
        return old;
      if (key === 'locale' && value !== 'en' && value !== 'fr') return old;
      return {
        ...old,
        draft: { ...old.draft, [key]: value },
        saveState: 'idle',
      };
    });
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !maySave || savingRef.current) return;

    // The explicit development fixture is editable for UX review, but never
    // authenticates or mutates a Vellira account. No API call is made here.
    if (localAccountPreview) {
      const updated: AccountProfile = {
        ...profile.draft,
        revision: profile.original.revision + 1,
      };
      setStored((old) =>
        old.kind === 'ready' && old.userId === userId && old.attempt === attempt
          ? {
              ...old,
              original: updated,
              draft: profileFields(updated),
              saveState: 'preview-saved',
            }
          : old
      );
      return;
    }

    savingRef.current = true;
    const snapshot = { ...profile.draft, revision: profile.original.revision };
    setStored((old) =>
      old.kind === 'ready' && old.userId === userId && old.attempt === attempt
        ? { ...old, saveState: 'saving' }
        : old
    );

    try {
      const updated = await saveAccountProfile(snapshot);
      if (!mountedRef.current) return;
      setStored((old) =>
        old.kind === 'ready' && old.userId === userId && old.attempt === attempt
          ? {
              ...old,
              original: updated,
              draft: profileFields(updated),
              saveState: 'saved',
            }
          : old
      );
    } catch (cause) {
      if (!mountedRef.current) return;
      const conflicted =
        cause instanceof VelliraApiError &&
        cause.status === 409 &&
        cause.code === 'profile_conflict';
      setStored((old) =>
        old.kind === 'ready' && old.userId === userId && old.attempt === attempt
          ? { ...old, saveState: conflicted ? 'conflict' : 'error' }
          : old
      );
    } finally {
      savingRef.current = false;
    }
  };

  const reload = () => {
    if (saving) return;
    setAttempt((old) => old + 1);
  };

  const preferredName =
    profile?.draft.displayName || profile?.draft.fullName || '';
  const avatarInitials = initials(preferredName);
  const zoneOptions = [...timeZones];
  const currentZone = profile?.draft.timeZone;
  const extraZones = [currentZone, deviceTimeZone].filter(
    (value): value is string =>
      !!value &&
      value !== 'Unavailable' &&
      !timeZones.some((known) => known === value)
  );
  const zones = [...zoneOptions, ...new Set(extraZones)];

  return (
    <section
      className={styles.root}
      aria-labelledby='account-state'
      data-profile-settings
    >
      <header className={styles.identityRow}>
        <div className={styles.avatar} aria-hidden='true'>
          {avatarInitials || <User size={28} />}
        </div>
        <div className={styles.identityCopy}>
          <h2 id='account-state' className={styles.title}>
            {preferredName || 'Your account'}
          </h2>
          <p className={styles.subtitle}>
            {preferredName ? 'Personal account' : 'Manage your personal Vellira profile.'}
          </p>
        </div>
        {me?.status === 'active' && (
          <span className={styles.activePill}>
            <Check size={14} aria-hidden='true' />
            Active
          </span>
        )}
      </header>

      {visible.kind === 'loading' && (
        <p role='status' className={styles.loadingState}>
          Loading your profile…
        </p>
      )}
      {visible.kind === 'error' && (
        <div className={styles.errorBlock}>
          <p role='alert'>
            Your profile is temporarily unavailable. No changes were made.
          </p>
          <Button
            appearance='outline'
            color='neutral'
            type='button'
            onClick={reload}
          >
            Try again
          </Button>
        </div>
      )}

      {profile && (
        <>
          <form
            className={styles.editForm}
            onSubmit={(event) => void save(event)}
          >
            <div className={styles.sectionHeading}>
              <h3>Personal information</h3>
              <p>Manage the information shown on your Vellira account.</p>
            </div>
            <div className={styles.fieldsGrid}>
              <Input
                label='Full name'
                value={profile.draft.fullName}
                onValueChange={(value) => change('fullName', value)}
                autoComplete='name'
                error={fullNameError}
                disabled={saving}
                size='md'
              />
              <Input
                label='Display name'
                value={profile.draft.displayName}
                onValueChange={(value) => change('displayName', value)}
                autoComplete='nickname'
                error={displayNameError}
                disabled={saving}
                size='md'
              />
            </div>
            <div className={styles.emailField}>
              <div className={styles.emailWithStatus}>
                <Input
                  label='Email address'
                  type='email'
                  value={localAccountPreview ? 'alex@example.com' : ''}
                  placeholder='Not available in this version'
                  readOnly
                  size='md'
                  wrapperClassName={styles.emailInput}
                />
                {me?.emailVerified && (
                  <Success size={19} aria-label='Email verified' />
                )}
              </div>
              <p className={styles.emailHelp}>
                {localAccountPreview
                  ? 'Example address for design review only — not your actual email.'
                  : 'Your sign-in email is managed by authentication. Read-only display will be connected separately.'}
              </p>
            </div>

            <div className={styles.sectionHeading}>
              <h3>Preferences</h3>
              <p>
                These preferences are stored in your account, not only on this
                device.
              </p>
            </div>
            <div className={styles.fieldsGrid}>
              <Select
                label='Language'
                value={profile.draft.locale}
                onValueChange={(value) => {
                  if (value) change('locale', value);
                }}
                disabled={saving}
                size='md'
              >
                <Select.Item value='en'>English</Select.Item>
                <Select.Item value='fr'>Français</Select.Item>
              </Select>
              <div className={styles.timeZoneControl}>
                <Select
                  label='Time zone'
                  value={profile.draft.timeZone}
                  onValueChange={(value) => {
                    if (value) change('timeZone', value);
                  }}
                  disabled={saving}
                  size='md'
                >
                  {zones.map((value) => (
                    <Select.Item key={value} value={value}>
                      {value}
                    </Select.Item>
                  ))}
                </Select>
                {deviceTimeZone &&
                  deviceTimeZone !== 'Unavailable' &&
                  deviceTimeZone !== profile.draft.timeZone && (
                    <Button
                      appearance='link'
                      color='neutral'
                      type='button'
                      disabled={saving}
                      onClick={() => change('timeZone', deviceTimeZone)}
                    >
                      Use device time zone ({deviceTimeZone})
                    </Button>
                  )}
              </div>
            </div>
            <p className={styles.preferencesHelp}>
              Language and time zone are saved as account preferences. Some parts of Vellira may still appear in English.
            </p>

            {profile.saveState === 'conflict' && (
              <div className={styles.feedback} role='alert'>
                This profile was changed elsewhere. Your edits are still here.
                To load the latest version, discard your unsaved changes and
                reload.
                <Button
                  appearance='outline'
                  color='neutral'
                  size='sm'
                  type='button'
                  onClick={reload}
                >
                  Discard edits and reload
                </Button>
              </div>
            )}
            {profile.saveState === 'error' && (
              <p role='alert' className={styles.errorText}>
                We could not save your profile. Your edits were kept. Try again.
              </p>
            )}
            {profile.saveState === 'saved' && (
              <p role='status' className={styles.successText}>
                Changes saved.
              </p>
            )}
            {profile.saveState === 'preview-saved' && (
              <p role='status' className={styles.successText}>
                Preview saved on this page only. No changes were sent to Vellira.
              </p>
            )}
            {localAccountPreview && (
              <p className={styles.mutedNote}>
                Local design preview — edit freely. Nothing is sent to your account.
              </p>
            )}
            <div className={styles.formActions}>
              {dirty && !saving && (
                <span className={styles.unsavedText}>Unsaved changes</span>
              )}
              <Button
                type='submit'
                appearance='solid'
                color='primary'
                size='md'
                loading={saving}
                loadingText='Saving…'
                disabled={!maySave}
              >
                Save changes
              </Button>
            </div>
          </form>
        </>
      )}

      <div className={styles.accountDetails}>
        <div className={styles.sectionHeading}>
          <h3>Account details</h3>
          <p>
            Authentication details are managed separately from your public
            profile.
          </p>
        </div>
        <dl className={styles.detailsList}>
          <div className={styles.detailRow}>
            <dt>Account status</dt>
            <dd>{me?.status ?? 'Unavailable'}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Email verification</dt>
            <dd className={styles.verification}>
              {me ? (
                <>
                  <span
                    className={
                      me.emailVerified ? styles.verified : styles.unverified
                    }
                  >
                    {me.emailVerified ? (
                      <Success size={18} aria-hidden='true' />
                    ) : (
                      <Error size={18} aria-hidden='true' />
                    )}
                    {me.emailVerified ? 'Verified' : 'Not verified'}
                  </span>
                  {!me.emailVerified && <EmailVerificationResend />}
                </>
              ) : (
                'Unavailable'
              )}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Time zone (device)</dt>
            <dd>{deviceTimeZone ?? 'Detecting…'}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Sign-in email</dt>
            <dd className={styles.secondaryDetail}>
              Email address is managed by Vellira authentication; profile data
              does not expose it.
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
