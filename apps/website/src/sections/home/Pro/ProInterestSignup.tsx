'use client';

import { Button, FormField, Input } from '@vellira-ui/react';
import { useState, type FormEvent } from 'react';

import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import styles from './Pro.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBSCRIBE_ENDPOINT = '/api/newsletter/subscribe';
const FALLBACK_ERROR =
  'Signup is temporarily unavailable. Please try again later.';

const apiErrors = {
  invalid_email: 'Enter a valid email address.',
  consent_required: 'Please confirm that you want Pro updates.',
  already_subscribed:
    'This address is already subscribed or awaiting confirmation.',
  rate_limited: 'Please wait a few minutes and try again.',
  temporarily_unavailable: FALLBACK_ERROR,
} as const;

function errorFromResponse(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    typeof payload.code === 'string' &&
    payload.code in apiErrors
  ) {
    return apiErrors[payload.code as keyof typeof apiErrors];
  }

  return FALLBACK_ERROR;
}

export function ProInterestSignup() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationRequested, setConfirmationRequested] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address) || address.length > 320) {
      setError('Enter a valid email address.');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: address,
          purpose: 'pro_launch',
          consent: true,
        }),
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);

      if (
        response.ok &&
        typeof payload === 'object' &&
        payload !== null &&
        'ok' in payload &&
        payload.ok === true
      ) {
        setConfirmationRequested(true);
        setEmail('');
        return;
      }

      setError(errorFromResponse(payload));
    } catch {
      setError(FALLBACK_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.interest} aria-labelledby='pro-interest-title'>
      <h4 id='pro-interest-title' className={styles.interestTitle}>
        Get Pro updates
      </h4>
      <p className={styles.interestDescription}>
        Occasional engineering notes and news about Vellira Pro, including its
        launch. No pre-order or payment.
      </p>
      {confirmationRequested ? (
        <p className={styles.interestSuccess} role='status'>
          Thanks for your interest. If a confirmation email arrives, follow its
          link to finish signing up.
        </p>
      ) : (
        <form noValidate aria-busy={isSubmitting} onSubmit={onSubmit}>
          <FormField
            label='Email address'
            error={error}
            bindControl={false}
            message=' '
          >
            <div className={styles.interestControls}>
              <Input
                name='email'
                type='email'
                autoComplete='email'
                required
                placeholder='you@example.com'
                value={email}
                disabled={isSubmitting}
                onValueChange={(value) => {
                  setEmail(value);
                  setError(undefined);
                }}
              />
              <Button
                type='submit'
                shape='rounded'
                loading={isSubmitting}
                loadingText='Subscribing'
              >
                Keep me posted
              </Button>
            </div>
          </FormField>
        </form>
      )}
      <p className={styles.interestPrivacy}>
        By subscribing, you request Vellira engineering and Pro launch emails.
        Confirm by email; unsubscribe anytime.{' '}
        <DesignSystemLink href='/privacy'>Privacy</DesignSystemLink>
      </p>
    </section>
  );
}
