'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, Input, Modal, Portal, Select } from '@vellira-ui/react';

import {
  getAccountDeletionRequestStatus,
  submitAccountDeletionRequest,
  verifyAccountDeletionPassword,
  VelliraApiError,
  type AccountDeletionRequestStatus,
} from './api';
import { localAccountPreview, useAppSession } from './AppSession';

import profileStyles from './AccountProfilePanel.module.css';
import styles from './AccountDeletionPanel.module.css';

// The request endpoint records pending_review only; it does not erase data.
// Public deployment remains disabled until independent backend/UX admission.
const requestFeatureEnabled =
  process.env.NEXT_PUBLIC_VELLIRA_ACCOUNT_DELETION_REQUEST_ENABLED === 'true';

type DeletionRead =
  | { kind: 'loading' | 'error'; userId: string; revision: number }
  | {
      kind: 'ready';
      userId: string;
      revision: number;
      value: AccountDeletionRequestStatus;
    };

function requestFailureMessage(cause: unknown): string {
  if (cause instanceof VelliraApiError) {
    switch (cause.code) {
      case 'step_up_denied':
        return 'Password verification failed. Check your password and try again.';
      case 'rate_limited':
        return 'Too many verification attempts. Try again later.';
      case 'deletion_already_requested':
        return 'An account deletion request is already pending. Refresh its status.';
      case 'step_up_required':
        return 'Identity verification expired. Please try again.';
      case 'csrf_invalid':
        return 'Your session could not be verified. Refresh and try again.';
      default:
        return 'Deletion requests are temporarily unavailable. No deletion was confirmed.';
    }
  }
  return 'The request result could not be verified. Check the request status before trying again.';
}

export function AccountDeletionPanel() {
  const { me, status } = useAppSession();
  const userId = me?.id ?? '';
  const identityRef = useRef(userId);
  useEffect(() => {
    identityRef.current = userId;
  }, [userId]);

  const previewEnabled = localAccountPreview && status === 'ready' && !!userId;
  const requestEnabled =
    !localAccountPreview &&
    requestFeatureEnabled &&
    status === 'ready' &&
    !!userId;

  const [revision, setRevision] = useState(0);
  const [dialogUserId, setDialogUserId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [statusMustBeChecked, setStatusMustBeChecked] = useState(false);
  const [previewStatus, setPreviewStatus] =
    useState<AccountDeletionRequestStatus>('none');
  const [storedRead, setStoredRead] = useState<DeletionRead>({
    kind: 'loading',
    userId: '',
    revision: 0,
  });

  useEffect(() => {
    if (localAccountPreview || status !== 'ready' || !userId) return;

    const abort = new AbortController();
    void getAccountDeletionRequestStatus(abort.signal)
      .then((value) => {
        if (!abort.signal.aborted) {
          setStoredRead({ kind: 'ready', userId, revision, value });
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setStoredRead({ kind: 'error', userId, revision });
        }
      });

    return () => abort.abort();
  }, [status, userId, revision]);

  // Never display previous account's deletion status on a principal change.
  const visibleRead: DeletionRead =
    status === 'ready' &&
    !!userId &&
    storedRead.userId === userId &&
    storedRead.revision === revision
      ? storedRead
      : { kind: 'loading', userId, revision };
  const displayRead: DeletionRead = previewEnabled
    ? { kind: 'ready', userId, revision, value: previewStatus }
    : visibleRead;

  const mayRequest =
    requestEnabled &&
    displayRead.kind === 'ready' &&
    displayRead.value === 'none';
  const mayOpen = previewEnabled || mayRequest;
  const dialogOpen = mayOpen && dialogUserId === userId;

  const submit = async () => {
    if (
      !mayRequest ||
      dialogUserId !== userId ||
      password.length === 0 ||
      submittingRef.current
    ) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setRequestError(null);
    setStatusMustBeChecked(false);
    const initiatingUser = userId;
    try {
      // Server owns the grant in a one-use HttpOnly cookie. Never store it in
      // JavaScript, the URL, a browser cache, or account-profile state.
      await verifyAccountDeletionPassword(password);
      if (identityRef.current !== initiatingUser) return;
      const result = await submitAccountDeletionRequest();
      if (identityRef.current !== initiatingUser) return;
      setStoredRead({
        kind: 'ready',
        userId: initiatingUser,
        revision,
        value: result,
      });
      setDialogUserId(null);
    } catch (cause) {
      if (identityRef.current === initiatingUser) {
        if (
          cause instanceof VelliraApiError &&
          cause.code === 'deletion_already_requested'
        ) {
          setDialogUserId(null);
          setRevision((current) => current + 1);
        } else {
          setRequestError(requestFailureMessage(cause));
          // Any unknown acknowledgment may mean the request COMMITTED.
          // Refuse another submission until the status is checked.
          if (
            !(cause instanceof VelliraApiError) ||
            !['step_up_denied', 'rate_limited', 'step_up_required', 'csrf_invalid'].includes(
              cause.code
            )
          ) {
            setStatusMustBeChecked(true);
          }
        }
      }
    } finally {
      setPassword('');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section
      className={[profileStyles.accountCard, styles.root].join(' ')}
      aria-labelledby='account-danger-zone'
      data-account-deletion
    >
      <h3 id='account-danger-zone' className={styles.heading}>
        Danger zone
      </h3>
      <div className={styles.actionRow}>
        <div className={styles.copy}>
          <h4>Delete account</h4>
          <p>Request permanent removal of your Vellira account.</p>
          <p>Some information may need to be retained for legal obligations.</p>
        </div>
        <Modal
          role='alertdialog'
          open={dialogOpen}
          onOpenChange={(nextOpen) => {
            if (submittingRef.current) return;
            setDialogUserId(nextOpen && mayOpen ? userId : null);
            setPassword('');
            setRequestError(null);
            setStatusMustBeChecked(false);
          }}
          closeOnOutsidePress={false}
        >
          <Modal.Trigger asChild disabled={!mayOpen}>
            <Button
              type='button'
              appearance='outline'
              color='danger'
              size='sm'
              disabled={!mayOpen}
              aria-describedby='account-deletion-help'
            >
              {previewEnabled ? 'Delete account' : 'Request deletion'}
            </Button>
          </Modal.Trigger>
          {mayOpen && (
            <Portal>
              <Modal.Overlay />
              <Modal.Content size='sm' scrollBehavior='inside'>
                <Modal.Header>
                  <div>
                    <Modal.Title>
                      {previewEnabled ? 'Delete your account?' : 'Request account deletion?'}
                    </Modal.Title>
                    <Modal.Description>
                      Deletion is irreversible after execution. A request does
                      not mean your account is already deleted.
                    </Modal.Description>
                  </div>
                  <Modal.Close />
                </Modal.Header>
                <Modal.Body>
                  {previewEnabled ? (
                    <div className={styles.previewMessage}>
                      <p>This preview never sends a deletion request.</p>
                      <p>Real deletion requires identity and data checks.</p>
                    </div>
                  ) : (
                    <div className={styles.previewMessage}>
                      <p>
                        Confirm your current password to submit a deletion
                        request. It may require additional review of workspaces,
                        subscriptions, and retained records.
                      </p>
                      <p>
                        Your account remains active until deletion is actually
                        completed and confirmed.
                      </p>
                      <Input
                        label='Current password'
                        type='password'
                        value={password}
                        autoComplete='current-password'
                        onValueChange={setPassword}
                        disabled={submitting}
                        size='md'
                      />
                      {requestError && <p role='alert'>{requestError}</p>}
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Modal.Close asChild>
                    <Button
                      appearance='ghost'
                      color='neutral'
                      type='button'
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                  </Modal.Close>
                  {statusMustBeChecked ? (
                    <Button
                      type='button'
                      appearance='outline'
                      color='neutral'
                      onClick={() => {
                        setDialogUserId(null);
                        setRevision((current) => current + 1);
                      }}
                    >
                      Check request status
                    </Button>
                  ) : (
                    <Button
                      color='danger'
                      type='button'
                      disabled={previewEnabled || !password || submitting}
                      onClick={() => void submit()}
                    >
                      {previewEnabled
                        ? 'Confirm deletion'
                        : submitting
                          ? 'Submitting…'
                          : 'Submit deletion request'}
                    </Button>
                  )}
                </Modal.Footer>
              </Modal.Content>
            </Portal>
          )}
        </Modal>
      </div>

      {previewEnabled && (
        <div className={styles.previewControls} data-deletion-status-preview>
          <Select
            label='Preview request status'
            value={previewStatus}
            size='md'
            onValueChange={(value) => {
              if (value === 'none' || value === 'pending_review') {
                setPreviewStatus(value);
              }
            }}
          >
            <Select.Item value='none'>No request</Select.Item>
            <Select.Item value='pending_review'>Pending review</Select.Item>
          </Select>
          <p>Local preview only. No status request is sent to Vellira.</p>
        </div>
      )}
      {status === 'ready' && !!userId && (
        <div className={styles.requestStatus} data-account-deletion-status>
          {displayRead.kind === 'loading' && (
            <p role='status'>Checking deletion request status…</p>
          )}
          {displayRead.kind === 'ready' && displayRead.value === 'none' && (
            <p role='status'>No deletion request is pending.</p>
          )}
          {displayRead.kind === 'ready' &&
            displayRead.value === 'pending_review' && (
              <p role='status'>
                Deletion request pending review. Your account remains active;
                no data has been erased.
              </p>
            )}
          {displayRead.kind === 'error' && (
            <div className={styles.statusError}>
              <p role='alert'>
                Deletion request status is temporarily unavailable.
              </p>
              <Button
                type='button'
                appearance='link'
                color='neutral'
                size='sm'
                onClick={() => setRevision((current) => current + 1)}
              >
                Retry status
              </Button>
            </div>
          )}
        </div>
      )}
      <p id='account-deletion-help' className={styles.help}>
        {previewEnabled
          ? 'Demo only — this action cannot delete an account.'
          : requestEnabled
            ? 'Requests are verified and reviewed before any irreversible deletion. Submitting a request does not erase data.'
            : 'Deletion requests are unavailable until secure identity verification and data erasure are enabled.'}
      </p>
    </section>
  );
}
