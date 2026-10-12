'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import {
  getWorkspaceBilling,
  VelliraApiError,
  type WorkspaceSubscription,
} from './api';
import { useAppSession } from './AppSession';

import styles from './AppShell.module.css';

type BillingState =
  | { kind: 'loading' }
  | { kind: 'ready'; subscription: WorkspaceSubscription | null }
  | { kind: 'preview' }
  | { kind: 'denied' }
  | { kind: 'error' };

const localPreview =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW === '1';

function formatBillingDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return null;

  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date);
}

// This is deliberately a *read* view. Checkout, invoices and cancellation
// require separate reviewed operations; no frontend plan grants Pro access.
export function BillingSettings() {
  const { workspace } = useAppSession();
  const workspaceId = workspace?.id;
  const isOwner = workspace?.membership.role === 'owner';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<BillingState>({ kind: 'loading' });

  useEffect(() => {
    let disposed = false;

    if (!workspaceId || !isOwner) {
      setState({ kind: 'denied' });
      return;
    }

    if (localPreview) {
      setState({ kind: 'preview' });
      return;
    }

    setState({ kind: 'loading' });

    void getWorkspaceBilling(workspaceId)
      .then(({ subscription }) => {
        if (!disposed) setState({ kind: 'ready', subscription });
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setState({
          kind:
            cause instanceof VelliraApiError &&
            (cause.code === 'permission_denied' || cause.status === 403)
              ? 'denied'
              : 'error',
        });
      });

    return () => {
      disposed = true;
    };
  }, [isOwner, revision, workspaceId]);

  return (
    <div className={styles.page}>
      <header className={styles.settingsHeader}>
        <p className={styles.eyebrow}>Account settings</p>
        <h1>Billing</h1>
        <p>Review the current billing state of your workspace.</p>
      </header>

      <section
        className={styles.settingsSection}
        aria-labelledby='billing-status-title'
      >
        <h2 id='billing-status-title'>Subscription</h2>

        {state.kind === 'loading' && (
          <p role='status'>Loading billing information…</p>
        )}

        {state.kind === 'preview' && (
          <p role='status'>
            Billing information is not connected in local UI preview. Sign in
            with a real account to review your workspace subscription.
          </p>
        )}

        {state.kind === 'denied' && (
          <p role='alert'>
            Only an authorized workspace owner can view billing information.
          </p>
        )}

        {state.kind === 'error' && (
          <div className={styles.settingsContent}>
            <p role='alert'>
              Billing information is temporarily unavailable. Please try
              again.
            </p>
            <Button
              appearance='outline'
              color='neutral'
              onClick={() => setRevision((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        )}

        {state.kind === 'ready' && !state.subscription && (
          <div className={styles.settingsContent}>
            <strong>No subscription</strong>
            <p>There is no subscription associated with this workspace.</p>
          </div>
        )}

        {state.kind === 'ready' && state.subscription && (
          <dl className={styles.settingsList}>
            <div>
              <dt>Subscription status</dt>
              <dd>{state.subscription.status.replaceAll('_', ' ')}</dd>
            </div>
            {formatBillingDate(state.subscription.currentPeriodStart) && (
              <div>
                <dt>Current period starts</dt>
                <dd>
                  {formatBillingDate(state.subscription.currentPeriodStart)}
                </dd>
              </div>
            )}
            {formatBillingDate(state.subscription.currentPeriodEnd) && (
              <div>
                <dt>Current period ends</dt>
                <dd>{formatBillingDate(state.subscription.currentPeriodEnd)}</dd>
              </div>
            )}
            {formatBillingDate(state.subscription.scheduledEndAt) && (
              <div>
                <dt>Scheduled end</dt>
                <dd>{formatBillingDate(state.subscription.scheduledEndAt)}</dd>
              </div>
            )}
            {formatBillingDate(state.subscription.endedAt) && (
              <div>
                <dt>Ended on</dt>
                <dd>{formatBillingDate(state.subscription.endedAt)}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <div className={styles.actions}>
        <Button asChild appearance='outline' color='neutral'>
          <Link href='/app/settings'>Back to account settings</Link>
        </Button>
      </div>
    </div>
  );
}
