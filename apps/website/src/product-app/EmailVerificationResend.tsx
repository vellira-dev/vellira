'use client';

import { useState } from 'react';

import { Button } from '@vellira-ui/react';

import { resendCurrentVerification, VelliraApiError } from './api';
import { localAccountPreview } from './AppSession';

import styles from './EmailVerificationResend.module.css';

// Shared by Account and the unverified email banner. Never simulates an API
// success or contacts production while using development-only fixture data.
export function EmailVerificationResend({ className }: { className?: string }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const resend = async () => {
    if (sending || localAccountPreview) return;

    setSending(true);
    setMessage(undefined);
    setError(undefined);

    try {
      await resendCurrentVerification();
      setMessage(
        'If verification is still needed, check your inbox for a new verification email.'
      );
    } catch (cause) {
      setError(
        cause instanceof VelliraApiError && cause.code === 'rate_limited'
          ? 'Too many requests. Please try again shortly.'
          : 'Verification email is temporarily unavailable. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <Button
        type='button'
        size='sm'
        appearance='outline'
        color='neutral'
        loading={sending}
        loadingText='Sending…'
        disabled={sending || localAccountPreview}
        onClick={() => void resend()}
      >
        Resend verification email
      </Button>
      {localAccountPreview && (
        <span className={styles.previewNote}>
          Disabled in local UI preview — no email is sent.
        </span>
      )}
      {message && (
        <span className={styles.message} role='status'>
          {message}
        </span>
      )}
      {error && (
        <span className={styles.error} role='alert'>
          {error}
        </span>
      )}
    </div>
  );
}
