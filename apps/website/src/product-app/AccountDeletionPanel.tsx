'use client';

import { useState } from 'react';

import { Button, Modal, Portal } from '@vellira-ui/react';

import { localAccountPreview, useAppSession } from './AppSession';

import profileStyles from './AccountProfilePanel.module.css';
import styles from './AccountDeletionPanel.module.css';

// Account deletion has no authorized backend contract yet (#196). This card
// never calls an API or mutates account state. Only the explicit local
// development fixture can open the non-mutating confirmation preview.
export function AccountDeletionPanel() {
  const { me, status } = useAppSession();
  const userId = me?.id ?? '';
  const previewEnabled = localAccountPreview && status === 'ready' && !!userId;
  const [dialogUserId, setDialogUserId] = useState<string | null>(null);
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
                      Identity verification is required before account deletion.
                    </Modal.Description>
                  </div>
                  <Modal.Close />
                </Modal.Header>
                <Modal.Body>
                  <div className={styles.previewMessage}>
                    <p>This preview never sends a deletion request.</p>
                    <p>Real deletion will describe removed and retained data.</p>
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
      <p id='account-deletion-help' className={styles.help}>
        {previewEnabled
          ? 'Local UI preview only — this action cannot delete an account.'
          : 'Account deletion will be available only after secure identity verification and data erasure are enabled.'}
      </p>
    </section>
  );
}
