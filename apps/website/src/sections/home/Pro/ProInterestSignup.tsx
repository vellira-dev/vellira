'use client';

import { Button, Checkbox, FormField, Input } from '@vellira-ui/react';
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
  const [emailError, setEmailError] = useState<string>();
  const [consentError, setConsentError] = useState<string>();
  const [hasConsent, setHasConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationRequested, setConfirmationRequested] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const address = email.trim();
    if (!EMAIL_PATTERN.test(address) || address.length > 320) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (!hasConsent) {
      setConsentError('Please confirm that you want Vellira email updates.');
      return;
    }

    setEmailError(undefined);
    setConsentError(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: address,
          purpose: 'pro_launch',
          consent: hasConsent,
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
        setHasConsent(false);
        return;
      }

      setEmailError(errorFromResponse(payload));
    } catch {
      setEmailError(FALLBACK_ERROR);
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
        Occasional Vellira engineering notes, including Pro development and
        launch news. One newsletter, not a reservation. No pre-order or payment.
      </p>
      {confirmationRequested ? (
        <p className={styles.interestSuccess} role='status'>
          Your request was received. If you receive a confirmation email, follow
          its link to finish subscribing. No subscription is confirmed just by
          submitting this form.
        </p>
      ) : (
        <form
          className={styles.interestForm}
          noValidate
          aria-busy={isSubmitting}
          onSubmit={onSubmit}
        >
          <FormField
            label='Email address'
            error={emailError}
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
                  setEmailError(undefined);
                }}
              />
            </div>
          </FormField>
          <Checkbox
            name='pro-interest-consent'
            label={
              <>
                I agree to receive Vellira engineering notes, including
                occasional Pro launch updates, by email.
              </>
            }
            checked={hasConsent}
            onCheckedChange={(checked) => {
              setHasConsent(checked);
              setConsentError(undefined);
            }}
            required
            disabled={isSubmitting}
            error={consentError}
          />
          <Button
            className={styles.interestSubmit}
            type='submit'
            shape='rounded'
            loading={isSubmitting}
            loadingText='Subscribing'
          >
            Keep me posted
          </Button>
        </form>
      )}
      <p className={styles.interestPrivacy}>
        This is one Vellira newsletter, managed by Buttondown, not a separate
        Pro mailing list. Confirm by email; unsubscribe anytime.{' '}
        <DesignSystemLink href='/privacy'>Privacy</DesignSystemLink>
      </p>
    </section>
  );
}
