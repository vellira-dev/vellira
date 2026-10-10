'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@vellira-ui/react';
import type { OAuthLoginMethod } from './authPreference';
import { AuthSurface } from './AuthSurface';
import { AuthTextLink } from './AuthTextLink';
import { LoginForm } from './AuthFlows';
import {
  completeOAuthConnection,
  getOAuthConnection,
  VelliraApiError,
} from './api';
import {
  oauthProviderName,
  readOAuthConnection,
  type OAuthConnection,
} from './oauthConnection';
import styles from './AuthSurface.module.css';

type Status =
  'loading' | 'sign-in' | 'confirm' | 'complete' | 'expired' | 'retry';
export function OAuthConnectionFlow({
  providers = [],
}: {
  providers?: readonly OAuthLoginMethod[];
}) {
  const [connection, setConnection] = useState<OAuthConnection>();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const requestGeneration = useRef(0);

  const refresh = useCallback(
    async (link: OAuthConnection, afterAuthentication = false) => {
      const generation = ++requestGeneration.current;
      setStatus('loading');
      setError(undefined);
      try {
        const result = await getOAuthConnection(link);
        if (generation === requestGeneration.current) {
          setStatus(result.readyToConnect ? 'confirm' : 'sign-in');
          if (afterAuthentication && !result.readyToConnect)
            setError(
              'That sign-in did not confirm the account for this connection. Try a method already connected to the original account.'
            );
        }
      } catch (cause) {
        if (generation !== requestGeneration.current) return;
        setStatus(
          cause instanceof VelliraApiError && cause.code === 'link_invalid'
            ? 'expired'
            : 'retry'
        );
      }
    },
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const link =
      params.size === 2 && !window.location.hash
        ? readOAuthConnection(params)
        : undefined;
    if (!link) {
      setStatus('expired');
      return;
    }
    setConnection(link);
    void refresh(link);
    return () => {
      requestGeneration.current++;
    };
  }, [refresh]);
  useEffect(() => {
    if (status !== 'loading') messageRef.current?.focus();
  }, [status, error]);

  const complete = async () => {
    if (!connection || submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await completeOAuthConnection(connection);
      setStatus('complete');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.code === 'link_invalid')
        setStatus('expired');
      else if (
        cause instanceof VelliraApiError &&
        [
          'link_authentication_required',
          'unauthenticated',
          'account_disabled',
        ].includes(cause.code)
      ) {
        setStatus('sign-in');
        setError('Sign in to the existing account again before connecting.');
      } else
        setError(
          cause instanceof VelliraApiError && cause.code === 'rate_limited'
            ? 'Too many requests. Please wait a minute and try again.'
            : 'The connection could not be confirmed. Please try again.'
        );
    } finally {
      setSubmitting(false);
    }
  };
  const provider = connection
    ? oauthProviderName(connection.provider)
    : 'a login method';
  return (
    <AuthSurface
      title={
        status === 'confirm'
          ? `Connect ${provider} to your account?`
          : `Connect ${provider} to your Vellira account`
      }
      description='No second Vellira account will be created.'
    >
      <div
        className={styles.actions}
        aria-busy={submitting || status === 'loading'}
      >
        {status === 'loading' && (
          <p className={styles.message} role='status'>
            Checking connection request…
          </p>
        )}
        {error && (
          <p
            ref={messageRef}
            className={styles.error}
            role='alert'
            tabIndex={-1}
          >
            {error}
          </p>
        )}
        {status === 'sign-in' && connection && (
          <>
            <p
              ref={!error ? messageRef : undefined}
              className={styles.message}
              tabIndex={-1}
            >
              A Vellira account already exists for this email. Sign in to your
              existing Vellira account once to connect {provider}.
            </p>
            <LoginForm
              providers={providers}
              connection={connection}
              onAuthenticated={() => refresh(connection, true)}
            />
            <p className={styles.message}>
              If you reset your password in another tab, return here and sign
              in. If your existing provider is unavailable, try another
              connected method or try again later.
            </p>
          </>
        )}
        {status === 'confirm' && (
          <>
            <p
              ref={!error ? messageRef : undefined}
              className={styles.message}
              tabIndex={-1}
            >
              {provider} will become another way to sign in to this same Vellira
              account. Confirm below to connect it.
            </p>
            <Button
              onClick={() => void complete()}
              loading={submitting}
              disabled={submitting}
              loadingText='Connecting…'
            >
              Connect {provider}
            </Button>
          </>
        )}
        {status === 'complete' && (
          <>
            <p
              ref={messageRef}
              className={styles.message}
              role='status'
              tabIndex={-1}
            >
              {provider} is connected to your Vellira account.
            </p>
            <Button asChild>
              <Link href='/app'>Continue to Vellira</Link>
            </Button>
          </>
        )}
        {status === 'expired' && (
          <>
            <p
              ref={messageRef}
              className={styles.error}
              role='alert'
              tabIndex={-1}
            >
              This connection request is unavailable or has expired. Sign in
              again with the provider you want to connect to start a new
              request.
            </p>
            <Button asChild>
              <Link href='/login'>Start again</Link>
            </Button>
          </>
        )}
        {status === 'retry' && connection && (
          <>
            <p
              ref={messageRef}
              className={styles.error}
              role='alert'
              tabIndex={-1}
            >
              The connection request could not be loaded. Please try again.
            </p>
            <Button onClick={() => void refresh(connection)}>Try again</Button>
          </>
        )}
        {status !== 'complete' && (
          <AuthTextLink href='/login'>Cancel connection</AuthTextLink>
        )}
      </div>
    </AuthSurface>
  );
}
