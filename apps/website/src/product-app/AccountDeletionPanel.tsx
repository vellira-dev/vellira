'use client';

import { useEffect, useState } from 'react';

import { Button, Modal, Portal } from '@vellira-ui/react';

import {
  getAccountDeletionRequestStatus,
  type AccountDeletionRequestStatus,
} from './api';
import { localAccountPreview, useAppSession } from './AppSession';

import profileStyles from './AccountProfilePanel.module.css';
import styles from './AccountDeletionPanel.module.css';

// The only production request is an authenticated GET for status.
// Creating or completing an account deletion remains disabled; the local
// development fixture alone can open a non-mutating confirmation preview.
type DeletionRead =
  | { kind: 'loading' | 'error'; userId: string; revision: number }
  | {
      kind: 'ready';
      userId: string;
      revision: number;
      value: AccountDeletionRequestStatus;
    };

export function AccountDeletionPanel() {
  const { me, status } = useAppSession();
  const userId = me?.id ?? '';
  const previewEnabled = localAccountPreview && status === 'ready' && !!userId;
  const [revision, setRevision] = useState(0);
  const [dialogUserId, setDialogUserId] = useState<string | null>(null);
  const [storedRead, setStoredRead] = useState<DeletionRead>({
    kind: 'loading',
    userId: '',
    revision: 0,
  });

  useEffect(() => {
    // This is a read-only session-scoped view, never a deletion request.
    // The local design fixture must not make real backend requests.
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

  // Never display the previous account's status while the current session
  // or a retry is resolving, including during the render before effects run.
  const visibleRead: DeletionRead =
    status === 'ready' &&
    !!userId &&
    storedRead.userId === userId &&
    storedRead.revision === revision
      ? storedRead
      : { kind: 'loading', userId, revision };
  const previewOpen = previewEnabled && dialogUserId === userId;

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
          <p>Close your account and request data removal.</p>
          <p>Some records may be retained for legal reasons.</p>
        </div>
        <Modal
          role='alertdialog'
          open={previewOpen}
          onOpenChange={(nextOpen) =>
            setDialogUserId(nextOpen && previewEnabled ? userId : null)
          }
          closeOnOutsidePress={false}
        >
          <Modal.Trigger asChild disabled={!previewEnabled}>
            <Button
              type='button'
              appearance='outline'
              color='danger'
              size='sm'
              disabled={!previewEnabled}
              aria-describedby='account-deletion-help'
            >
              Delete account
            </Button>
          </Modal.Trigger>
          {previewEnabled && (
            <Portal>
              <Modal.Overlay />
              <Modal.Content size='sm' scrollBehavior='inside'>
                <Modal.Header>
                  <div>
                    <Modal.Title>Delete your account?</Modal.Title>
                    <Modal.Description>
                      Identity verification is required before deletion.
                    </Modal.Description>
                  </div>
                  <Modal.Close />
                </Modal.Header>
                <Modal.Body>
                  <div className={styles.previewMessage}>
                    <p>This preview never sends a deletion request.</p>
                    <p>Real deletion requires identity and data checks.</p>
                  </div>
                </Modal.Body>
                <Modal.Footer>
                  <Modal.Close asChild>
                    <Button appearance='ghost' color='neutral' type='button'>
                      Cancel
                    </Button>
                  </Modal.Close>
                  <Button color='danger' type='button' disabled>
                    Confirm deletion
                  </Button>
                </Modal.Footer>
              </Modal.Content>
            </Portal>
          )}
        </Modal>
      </div>
      {!localAccountPreview && status === 'ready' && !!userId && (
        <div className={styles.requestStatus} data-account-deletion-status>
          {visibleRead.kind === 'loading' && (
            <p role='status'>Checking deletion request status…</p>
          )}
          {visibleRead.kind === 'ready' && visibleRead.value === 'none' && (
            <p role='status'>No deletion request is pending.</p>
          )}
          {visibleRead.kind === 'ready' &&
            visibleRead.value === 'pending_review' && (
              <p role='status'>
                Deletion request pending review. Your account remains active;
                no data has been erased.
              </p>
            )}
          {visibleRead.kind === 'error' && (
            <div className={styles.statusError}>
              <p role='alert'>Deletion request status is temporarily unavailable.</p>
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
          : 'Account deletion will be available only after secure identity verification and data erasure are enabled.'}
      </p>
    </section>
  );
}
