'use client';

import { useEffect, useState } from 'react';

import { Button } from '@vellira-ui/react';

import {
  getWorkspaceBilling,
  VelliraApiError,
  type WorkspaceSubscription,
} from './api';
import { useAppSession } from './AppSession';

import styles from './AccountSettings.module.css';

type BillingState =
  | { kind: 'loading' }
  | { kind: 'ready'; subscription: WorkspaceSubscription | null }
  | { kind: 'preview' }
  | { kind: 'denied' }
  | { kind: 'error' };

type WorkspaceBillingState = {
  workspaceId: string | undefined;
  revision: number;
  state: BillingState;
};

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
export function BillingPanel() {
  const { workspace } = useAppSession();
  const workspaceId = workspace?.id;
  const isOwner = workspace?.membership.role === 'owner';
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<WorkspaceBillingState>({
    workspaceId: undefined,
    revision: 0,
    state: { kind: 'loading' },
  });

  useEffect(() => {
    if (!workspaceId || !isOwner || localPreview) return;

    let disposed = false;
    void getWorkspaceBilling(workspaceId)
      .then(({ subscription }) => {
        if (!disposed) {
          setResult({ workspaceId, revision, state: { kind: 'ready', subscription } });
        }
      })
      .catch((cause: unknown) => {
        if (disposed) return;
        setResult({
          workspaceId,
          revision,
          state: {
            kind:
              cause instanceof VelliraApiError &&
              (cause.code === 'permission_denied' || cause.status === 403)
                ? 'denied'
                : 'error',
          },
        });
      });

    return () => {
      disposed = true;
    };
  }, [isOwner, revision, workspaceId]);

  // Never render another workspace's commercial data during a workspace change.
  const state: BillingState =
    !isOwner || !workspaceId
      ? { kind: 'denied' }
      : localPreview
        ? { kind: 'preview' }
        : result.workspaceId === workspaceId && result.revision === revision
          ? result.state
          : { kind: 'loading' };

  return (
    <section
      className={styles.panelContent}
      aria-labelledby='billing-status-title'
    >
      <div className={styles.sectionIntro}>
        <h2 id='billing-status-title' className={styles.sectionTitle}>
          Subscription
        </h2>
        <p className={styles.description}>
          Billing details from your current workspace.
        </p>
      </div>

      {state.kind === 'loading' && (
        <p className={styles.description} role='status'>
          Loading billing information…
        </p>
      )}

      {state.kind === 'preview' && (
        <p className={styles.description} role='status'>
          Billing information is not connected in local UI preview. Sign in with
          a real account to review your workspace subscription.
        </p>
      )}

      {state.kind === 'denied' && (
        <p className={styles.description} role='alert'>
          Only an authorized workspace owner can view billing information.
        </p>
      )}

      {state.kind === 'error' && (
        <div className={styles.billingBody}>
          <p role='alert'>
            Billing information is temporarily unavailable. Please try again.
          </p>
          <Button
            appearance='outline'
            color='neutral'
            onClick={() => {
              setRevision((value) => value + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {state.kind === 'ready' && !state.subscription && (
        <div className={styles.billingBody}>
          <strong>No subscription</strong>
          <p>There is no subscription associated with this workspace.</p>
        </div>
      )}

      {state.kind === 'ready' && state.subscription && (
        <dl className={styles.detailList}>
          <div className={styles.detailRow}>
            <dt>Subscription status</dt>
            <dd>{state.subscription.status.replaceAll('_', ' ')}</dd>
          </div>
          {formatBillingDate(state.subscription.currentPeriodStart) && (
            <div className={styles.detailRow}>
              <dt>Current period starts</dt>
              <dd>
                {formatBillingDate(state.subscription.currentPeriodStart)}
              </dd>
            </div>
          )}
          {formatBillingDate(state.subscription.currentPeriodEnd) && (
            <div className={styles.detailRow}>
              <dt>Current period ends</dt>
              <dd>{formatBillingDate(state.subscription.currentPeriodEnd)}</dd>
            </div>
          )}
          {formatBillingDate(state.subscription.scheduledEndAt) && (
            <div className={styles.detailRow}>
              <dt>Scheduled end</dt>
              <dd>{formatBillingDate(state.subscription.scheduledEndAt)}</dd>
            </div>
          )}
          {formatBillingDate(state.subscription.endedAt) && (
            <div className={styles.detailRow}>
              <dt>Ended on</dt>
              <dd>{formatBillingDate(state.subscription.endedAt)}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
