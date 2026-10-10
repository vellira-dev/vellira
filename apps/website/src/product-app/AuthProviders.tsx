'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { GitHub } from '@vellira-ui/icons';
import { Button, Tooltip } from '@vellira-ui/react';
import { getApiUrl } from './api';
import {
  prepareOAuthPreference,
  type OAuthLoginMethod,
} from './authPreference';
import {
  connectionQuery,
  oauthProviderName,
  type OAuthConnection,
} from './oauthConnection';
import styles from './AuthSurface.module.css';

export function AuthProviders({
  providers,
  remember,
  disabled,
  onRedirecting,
  connection,
}: {
  providers: readonly OAuthLoginMethod[];
  remember: boolean;
  disabled: boolean;
  onRedirecting: (value: boolean) => void;
  connection?: OAuthConnection;
}) {
  const started = useRef(false);
  const [error, setError] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        started.current = false;
        setRedirecting(false);
        onRedirecting(false);
      }
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [onRedirecting]);
  const available = providers.filter(
    (provider) => provider !== connection?.provider
  );
  if (!available.length) return null;
  const start = (provider: OAuthLoginMethod) => {
    if (started.current || disabled) return;
    started.current = true;
    setRedirecting(true);
    onRedirecting(true);
    setError(false);
    prepareOAuthPreference(remember);
    try {
      window.location.assign(
        getApiUrl(
          `/v1/auth/oauth/${provider}/start` +
            (connection ? '?' + connectionQuery(connection) : '')
        )
      );
    } catch {
      started.current = false;
      setRedirecting(false);
      onRedirecting(false);
      setError(true);
    }
  };
  return (
    <>
      <div
        className={styles.providerRow}
        role='group'
        aria-label='Continue with a provider'
      >
        {available.map((provider) => {
          const name = oauthProviderName(provider);
          const label = `Continue with ${name}`;
          return (
            <Tooltip key={provider}>
              <Tooltip.Trigger asChild>
                <Button
                  type='button'
                  appearance={provider === 'github' ? 'outline' : 'bare'}
                  color='neutral'
                  shape='square'
                  size='lg'
                  className={styles.providerButton}
                  aria-label={label}
                  disabled={disabled}
                  onClick={() => start(provider)}
                >
                  {provider === 'github' ? (
                    <GitHub size={24} aria-hidden='true' />
                  ) : (
                    <>
                      <Image
                        src={`/brand/auth/${provider === 'google' ? 'google-light' : 'apple-black'}.svg`}
                        alt=''
                        width={48}
                        height={48}
                        unoptimized
                        className={styles.providerLight}
                      />
                      <Image
                        src={`/brand/auth/${provider === 'google' ? 'google-dark' : 'apple-white'}.svg`}
                        alt=''
                        width={48}
                        height={48}
                        unoptimized
                        className={styles.providerDark}
                      />
                    </>
                  )}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>{label}</Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
      {redirecting && (
        <p className={styles.message} role='status'>
          Opening provider sign in…
        </p>
      )}
      {error && (
        <p className={styles.error} role='alert'>
          Provider sign in could not be opened. Please try again or sign in with
          email.
        </p>
      )}
      <div className={styles.authDivider} aria-hidden='true'>
        <span />
        OR
        <span />
      </div>
    </>
  );
}
