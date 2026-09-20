'use client';

import { Info } from '@vellira-ui/icons';
import { Button, Input, Portal, Tooltip } from '@vellira-ui/react';
import { useRef, useState, type FormEvent } from 'react';

import styles from './BlogNewsletterSignup.module.css';

const BUTTONDOWN_SUBSCRIBE_ENDPOINT =
  'https://buttondown.com/api/emails/embed-subscribe/vellira';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterSignupForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <form
      className={styles.form}
      action={BUTTONDOWN_SUBSCRIBE_ENDPOINT}
      method='post'
      noValidate
      onSubmit={handleSubmit}
    >
      <div className={styles.actions}>
        <input type='hidden' name='embed' value='1' />
        <div className={styles.field}>
          <div className={styles.helper}>
            <Tooltip placement='top'>
              <Tooltip.Trigger asChild>
                <Button
                  type='button'
                  appearance='bare'
                  color='neutral'
                  size='sm'
                  shape='rounded'
                  iconOnly
                  aria-label='Newsletter email privacy information'
                  iconStart={<Info aria-hidden='true' />}
                />
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Content withArrow>
                  We’ll only send Vellira engineering notes. Unsubscribe
                  anytime.
                </Tooltip.Content>
              </Portal>
            </Tooltip>
          </div>
          <Input
            ref={inputRef}
            label='Email address'
            name='email'
            type='email'
            autoComplete='email'
            placeholder='you@example.com'
            required
            value={email}
            error={error}
            onValueChange={(value) => {
              setEmail(value);
              setError(undefined);
            }}
          />
        </div>
        <Button className={styles.button} type='submit' shape='rounded'>
          Subscribe
        </Button>
      </div>
    </form>
  );
}
