'use client';

import { Button, FormField, Input, Portal, Tooltip } from '@vellira-ui/react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import styles from './BlogNewsletterSignup.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEWSLETTER_SUBSCRIBE_ENDPOINT = '/api/newsletter/subscribe';
const GENERIC_ERROR =
  'Newsletter signup is temporarily unavailable. Please try again later.';

const apiErrors = {
  invalid_email: 'Enter a valid email address.',
  already_subscribed:
    'This email is already subscribed or awaiting confirmation.',
  rate_limited: 'Please wait a few minutes and try again.',
  temporarily_unavailable: GENERIC_ERROR,
} as const;

function getApiErrorCode(payload: unknown): keyof typeof apiErrors | null {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'code' in payload &&
    typeof payload.code === 'string' &&
    payload.code in apiErrors
  ) {
    return payload.code as keyof typeof apiErrors;
  }

  return null;
}

export function NewsletterSignupForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const input = inputRef.current;

    if (!input || input.value.trim() === '') {
      event.preventDefault();
      setError('Enter your email address.');
      return;
    }

    if (
      input.validity.typeMismatch ||
      !input.validity.valid ||
      !EMAIL_PATTERN.test(input.value)
    ) {
      event.preventDefault();
      setError('Enter a valid email address.');
      return;
    }

    setError(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch(NEWSLETTER_SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value.trim() }),
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
        router.push('/newsletter/subscribed');
        return;
      }

      const code = getApiErrorCode(payload);
      setError(code ? apiErrors[code] : GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <FormField
        label='Email address'
        error={error}
        bindControl={false}
        className={styles.field}
        labelInfo={
          <Tooltip placement='top' delay={0}>
            <Tooltip.Trigger
              className={styles.infoTrigger}
              aria-label='Newsletter email privacy information'
            >
              <span aria-hidden='true'>i</span>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Content withArrow>
                We’ll only send Vellira engineering notes. Unsubscribe anytime.
              </Tooltip.Content>
            </Portal>
          </Tooltip>
        }
        message=' '
        messageClassName={styles.idleMessage}
        errorClassName={styles.errorMessage}
      >
        <div className={styles.controlRow} data-newsletter-control-row>
          <Input
            ref={inputRef}
            name='email'
            type='email'
            required
            autoComplete='email'
            placeholder='you@example.com'
            value={email}
            disabled={isSubmitting}
            onValueChange={(value) => {
              setEmail(value);
              setError(undefined);
            }}
          />
          <Button
            className={styles.button}
            type='submit'
            shape='rounded'
            loading={isSubmitting}
            loadingText='Subscribing'
          >
            Subscribe
          </Button>
        </div>
      </FormField>
    </form>
  );
}
