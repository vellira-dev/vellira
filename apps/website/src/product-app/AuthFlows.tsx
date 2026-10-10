'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft } from '@vellira-ui/icons';
import { Button, Checkbox, FormField, Input } from '@vellira-ui/react';

import { AuthProviders } from './AuthProviders';
import type { OAuthLoginMethod } from './authPreference';

import { validNewPassword } from './passwordPolicy';

import { AuthTextLink } from './AuthTextLink';
import {
  clearLoginPreference,
  clearOAuthPreferenceIntent,
  completeOAuthPreference,
  isOAuthLoginMethod,
  readSavedLoginPreference,
  saveLoginPreference,
  type SavedLoginMethod,
} from './authPreference';
import {
  getMe,
  login,
  register,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  verifyEmail,
  VelliraApiError,
} from './api';

import {
  connectionHref,
  isOAuthConnection,
  readOAuthConnection,
  type OAuthConnection,
} from './oauthConnection';

import styles from './AuthSurface.module.css';

function rememberLogin(
  enabled: boolean,
  method: SavedLoginMethod,
  email?: string
) {
  if (enabled) {
    saveLoginPreference(method, email);
  } else {
    clearLoginPreference();
  }
}

function genericAuthError(error: unknown, fallback: string) {
  if (error instanceof VelliraApiError && error.code === 'rate_limited') {
    return 'Too many requests. Please try again shortly.';
  }

  return fallback;
}

export function LoginForm({
  providers = [],
  connection,
  onAuthenticated,
}: {
  providers?: readonly OAuthLoginMethod[];
  connection?: OAuthConnection;
  onAuthenticated?: () => Promise<void>;
} = {}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = readSavedLoginPreference();
    if (!saved) return;
    setRemember(true);
    if (saved.email) {
      setEmail(saved.email);
    }
  }, []);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error && !submitting) errorRef.current?.focus();
  }, [error, submitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      rememberLogin(remember, 'email', email);
      setPassword('');
      if (onAuthenticated) {
        await onAuthenticated();
        setSubmitting(false);
      } else router.replace('/app');
    } catch (cause) {
      // Clear a rejected credential. A transient network failure may retain the
      // in-memory value for retry; neither path writes it to browser storage.
      if (
        cause instanceof VelliraApiError &&
        cause.code === 'invalid_credentials'
      )
        setPassword('');
      setError(
        cause instanceof VelliraApiError && cause.code === 'invalid_credentials'
          ? 'Invalid email or password.'
          : genericAuthError(
              cause,
              'Sign in is temporarily unavailable. Please try again.'
            )
      );
      setSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <AuthProviders
        providers={providers}
        remember={remember}
        disabled={submitting}
        onRedirecting={setSubmitting}
        connection={connection}
      />
      <FormField label='Email' required>
        <Input
          type='email'
          autoComplete='email'
          value={email}
          onValueChange={setEmail}
          required
          disabled={submitting}
        />
      </FormField>

      <FormField label='Password' required>
        <Input
          type='password'
          autoComplete='current-password'
          value={password}
          onValueChange={setPassword}
          required
          disabled={submitting}
        />
      </FormField>

      {error && (
        <p ref={errorRef} className={styles.error} role='alert' tabIndex={-1}>
          {error}
        </p>
      )}

      <Checkbox
        label='Save email and login method on this device'
        checked={remember}
        onCheckedChange={(checked) => {
          setRemember(checked);
          if (!checked) {
            clearLoginPreference();
          }
        }}
        disabled={submitting}
      />

      <div className={styles.actions}>
        <Button
          type='submit'
          loading={submitting}
          loadingText='Signing in…'
          disabled={submitting}
        >
          {connection ? 'Sign in and continue' : 'Sign in'}
        </Button>
      </div>

      <div className={styles.secondary}>
        <AuthTextLink
          href='/forgot-password'
          target={connection ? '_blank' : undefined}
          rel={connection ? 'noopener noreferrer' : undefined}
        >
          {connection ? 'Forgot password? (new tab)' : 'Forgot password?'}
        </AuthTextLink>
        {!connection && (
          <p className={styles.message}>
            Don&apos;t have an account?{' '}
            <AuthTextLink href='/signup'>Create account</AuthTextLink>
          </p>
        )}
      </div>
    </form>
  );
}

export function SignupForm({
  providers = [],
}: { providers?: readonly OAuthLoginMethod[] } = {}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [accountExists, setAccountExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    const saved = readSavedLoginPreference();
    if (!saved) return;
    setRemember(true);
    if (saved.email) {
      setEmail(saved.email);
    }
  }, []);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error && !submitting) errorRef.current?.focus();
  }, [error, submitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    if (!validNewPassword(password)) {
      setError('Use at least 12 characters and no more than 1024 UTF-8 bytes.');
      return;
    }
    setError(undefined);
    setAccountExists(false);
    setSubmitting(true);

    try {
      await register(email.trim(), password);
      rememberLogin(remember, 'email', email);
      router.replace('/app');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.code === 'account_exists') {
        setAccountExists(true);
        setError(
          'An account already exists for this email. Sign in using your existing method.'
        );
      } else {
        setError(
          cause instanceof VelliraApiError && cause.code === 'invalid_request'
            ? 'Use a valid email and a password of at least 12 characters.'
            : genericAuthError(
                cause,
                'Account creation is temporarily unavailable. Please try again.'
              )
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <AuthProviders
        providers={providers}
        remember={remember}
        disabled={submitting}
        onRedirecting={setSubmitting}
      />
      <FormField label='Email' required>
        <Input
          type='email'
          autoComplete='email'
          value={email}
          onValueChange={setEmail}
          required
          disabled={submitting}
        />
      </FormField>

      <FormField
        label='Password'
        description='Use at least 12 characters.'
        required
      >
        <Input
          type='password'
          autoComplete='new-password'
          value={password}
          onValueChange={setPassword}
          required
          disabled={submitting}
        />
      </FormField>

      {error && (
        <p ref={errorRef} className={styles.error} role='alert' tabIndex={-1}>
          {error}
        </p>
      )}

      {accountExists && (
        <div className={styles.secondary}>
          <AuthTextLink href='/login'>Sign in</AuthTextLink>
          <AuthTextLink href='/forgot-password'>Forgot password?</AuthTextLink>
        </div>
      )}

      <Checkbox
        label='Save email and login method on this device'
        checked={remember}
        onCheckedChange={(checked) => {
          setRemember(checked);
          if (!checked) {
            clearLoginPreference();
          }
        }}
        disabled={submitting}
      />

      <div className={styles.actions}>
        <Button
          type='submit'
          loading={submitting}
          loadingText='Creating account…'
          disabled={submitting}
        >
          Create account
        </Button>
      </div>

      <p className={styles.message}>
        Account data is handled according to the{' '}
        <AuthTextLink href='/privacy'>Vellira Privacy Policy</AuthTextLink>.
      </p>
    </form>
  );
}

export function VerificationFlow() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<
    'pending' | 'verifying' | 'verified' | 'invalid' | 'refresh-error'
  >('pending');
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const finishVerifiedSession = useCallback(async () => {
    setError(undefined);
    try {
      await getMe();
      router.replace('/app');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.status === 401) {
        setState('verified');
        return;
      }

      setState('refresh-error');
      setError(
        'Your email is verified, but Vellira could not refresh your account right now.'
      );
    }
  }, [router]);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get('token');

    if (!token) return;

    window.history.replaceState(null, '', window.location.pathname);
    setState('verifying');

    void verifyEmail(token)
      .then(() => finishVerifiedSession())
      .catch((cause) => {
        setState('invalid');
        setError(
          cause instanceof VelliraApiError && cause.code === 'invalid_challenge'
            ? 'This verification link is invalid or has expired.'
            : 'Email verification is temporarily unavailable.'
        );
      });
  }, [finishVerifiedSession]);

  const handleResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setMessage(undefined);
    setSubmitting(true);

    try {
      await requestVerification(email.trim());
      setMessage(
        'If verification is still needed, check your inbox for a new verification email.'
      );
    } catch (cause) {
      setError(
        genericAuthError(
          cause,
          'Verification email is temporarily unavailable.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'verifying') {
    return (
      <p className={styles.message} role='status'>
        Verifying your email…
      </p>
    );
  }

  if (state === 'refresh-error') {
    return (
      <div className={styles.actions}>
        <p className={styles.error} role='alert'>
          {error}
        </p>
        <Button onClick={() => void finishVerifiedSession()}>Try again</Button>
      </div>
    );
  }

  if (state === 'verified') {
    return (
      <div className={styles.actions}>
        <p className={styles.message} role='status'>
          Your email is verified. You can now sign in.
        </p>
        <Button asChild>
          <Link href='/login'>Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleResend}
      aria-busy={submitting}
    >
      <p className={styles.message}>
        Check your inbox and open the verification link to finish setting up
        your account.
      </p>

      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}

      <FormField
        label='Email'
        description='Enter your email if you need a new verification link.'
      >
        <Input
          type='email'
          autoComplete='email'
          value={email}
          onValueChange={setEmail}
          required
          disabled={submitting}
        />
      </FormField>

      {message && (
        <p className={styles.message} role='status'>
          {message}
        </p>
      )}

      <Button
        type='submit'
        appearance='outline'
        color='neutral'
        loading={submitting}
        loadingText='Sending…'
        disabled={submitting}
      >
        Resend verification email
      </Button>

      <AuthTextLink
        href='/login'
        iconStart={<ArrowLeft size={16} aria-hidden='true' />}
      >
        Back to sign in
      </AuthTextLink>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setSubmitting(true);

    try {
      await requestPasswordReset(email.trim());
      setAccepted(true);
    } catch (cause) {
      setError(
        genericAuthError(cause, 'Password recovery is temporarily unavailable.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <FormField label='Email' required>
        <Input
          type='email'
          autoComplete='email'
          value={email}
          onValueChange={setEmail}
          required
          disabled={submitting}
        />
      </FormField>

      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}

      {accepted && (
        <p className={styles.message} role='status'>
          If this account is eligible for password recovery, check your inbox
          for a reset link.
        </p>
      )}

      <Button
        type='submit'
        loading={submitting}
        loadingText='Sending…'
        disabled={submitting}
      >
        Send reset link
      </Button>

      <AuthTextLink
        href='/login'
        iconStart={<ArrowLeft size={16} aria-hidden='true' />}
      >
        Back to sign in
      </AuthTextLink>
    </form>
  );
}

export function ResetPasswordForm() {
  const capturedFragment = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // StrictMode may replay effects after the URL has already been scrubbed.
    // Keep the one capture only in this mounted form, never storage/history.
    if (capturedFragment.current) return;
    capturedFragment.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const tokens = fragment.getAll('token');
    const nextToken =
      tokens.length === 1 && tokens[0] && tokens[0].length <= 128
        ? tokens[0]
        : null;

    window.history.replaceState(null, '', window.location.pathname);
    setToken(nextToken);
    setReady(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !token) return;

    if (!validNewPassword(newPassword)) {
      setError('Use at least 12 characters and no more than 1024 UTF-8 bytes.');
      return;
    }
    setError(undefined);
    setSubmitting(true);

    try {
      await resetPassword(token, newPassword);
      setToken(null);
      setNewPassword('');
      setComplete(true);
    } catch (cause) {
      if (cause instanceof VelliraApiError) {
        if (cause.code === 'invalid_challenge') {
          setToken(null);
          setNewPassword('');
          setError('This reset link is invalid or has expired.');
        } else if (cause.code === 'invalid_request') {
          setError('Use a password of at least 12 characters.');
        } else {
          setError(
            genericAuthError(
              cause,
              'Password reset is temporarily unavailable.'
            )
          );
        }
      } else {
        setError('Password reset is temporarily unavailable.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <p className={styles.message} role='status'>
        Loading reset link…
      </p>
    );
  }

  if (complete) {
    return (
      <div className={styles.actions}>
        <p className={styles.message} role='status'>
          Your password has been updated. Existing sessions were revoked.
        </p>
        <Button asChild>
          <Link href='/login'>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.actions}>
        <p className={styles.error} role='alert'>
          {error ?? 'This reset link is missing or invalid.'}
        </p>
        <Button asChild appearance='outline' color='neutral'>
          <Link href='/forgot-password'>Request another reset link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      aria-busy={submitting}
    >
      <FormField
        label='New password'
        description='Use at least 12 characters.'
        required
      >
        <Input
          type='password'
          autoComplete='new-password'
          value={newPassword}
          onValueChange={setNewPassword}
          required
          disabled={submitting}
        />
      </FormField>

      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}

      <Button
        type='submit'
        loading={submitting}
        loadingText='Resetting password…'
        disabled={submitting}
      >
        Reset password
      </Button>
    </form>
  );
}

type OAuthCallbackFailure = {
  message: string;
  primary: {
    href: string;
    label: string;
  };
  secondary?: {
    href: string;
    label: string;
  };
};

function getOAuthCallbackFailure(
  code: string,
  provider?: string
): OAuthCallbackFailure {
  const providerName =
    provider === 'google'
      ? 'Google'
      : provider === 'apple'
        ? 'Apple'
        : provider === 'github'
          ? 'GitHub'
          : 'Provider';
  switch (code) {
    case 'rate_limited':
      return {
        message:
          'Too many sign-in attempts. Please wait a minute and try again.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'link_authentication_required':
      return {
        message:
          'Use a sign-in method already connected to your existing Vellira account. This sign-in did not confirm that account.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'account_link_required':
      return {
        message:
          'A Vellira account already exists for this email. Sign in using a method already connected to your account. The new provider has not been connected.',
        primary: { href: '/login', label: 'Sign in' },
        secondary: { href: '/forgot-password', label: 'Forgot password?' },
      };
    case 'oauth_cancelled':
      return {
        message: `${providerName} sign in was cancelled.`,
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'oauth_identity_ineligible':
      return {
        message: `${providerName} sign in requires a verified primary email on your provider account.`,
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'account_disabled':
      return {
        message: 'This Vellira account is currently unavailable.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'oauth_invalid':
      return {
        message: `This ${providerName} sign-in attempt expired or could not be verified. Please try again.`,
        primary: { href: '/login', label: 'Try again' },
      };
    default:
      return {
        message: `${providerName} sign in is temporarily unavailable. Please try again.`,
        primary: { href: '/login', label: 'Back to sign in' },
      };
  }
}

export function OAuthCallback() {
  const router = useRouter();
  const [failure, setFailure] = useState<OAuthCallbackFailure>();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errors = params.getAll('error');
    const providers = params.getAll('provider');
    const providerInput = providers.length === 1 ? providers[0] : undefined;
    const provider = isOAuthLoginMethod(providerInput)
      ? providerInput
      : !params.size &&
          isOAuthLoginMethod(window.history.state?.velliraOAuthProvider)
        ? window.history.state.velliraOAuthProvider
        : undefined;
    const connection =
      readOAuthConnection(params) ??
      (!params.size &&
      isOAuthConnection(window.history.state?.velliraOAuthConnection)
        ? (window.history.state.velliraOAuthConnection as OAuthConnection)
        : undefined);
    const hasConnectionInput =
      params.has('link') || params.has('link_provider');
    const invalidProvider =
      providers.length > 1 ||
      (providers.length === 1 && !provider) ||
      (hasConnectionInput && !connection);
    const successInput =
      params.size === (hasConnectionInput ? 3 : 1) &&
      provider &&
      !window.location.hash;
    const input = invalidProvider
      ? 'oauth_invalid'
      : errors.length === 1 && errors[0]
        ? errors[0]
        : params.size || window.location.hash
          ? successInput
            ? undefined
            : 'oauth_invalid'
          : window.history.state?.velliraOAuthError;
    // Only bounded presentation hints survive URL scrubbing, never auth proof.
    const historyState = { ...window.history.state };
    if (params.size) delete historyState.velliraOAuthError;
    delete historyState.velliraOAuthProvider;
    delete historyState.velliraOAuthConnection;
    if (connection && !invalidProvider)
      historyState.velliraOAuthConnection = connection;
    if (provider) historyState.velliraOAuthProvider = provider;
    window.history.replaceState(historyState, '', window.location.pathname);

    if (input !== undefined && input !== null) {
      const errorCode = [
        'account_link_required',
        'link_authentication_required',
        'oauth_cancelled',
        'oauth_identity_ineligible',
        'account_disabled',
        'oauth_invalid',
        'rate_limited',
      ].includes(input)
        ? input
        : 'oauth_unavailable';
      // This bounded display hint belongs only to this history entry. It is
      // never identity/session authority. Preserve Next's own history state,
      // and keep recovery available after refresh, back and repeated effects.
      window.history.replaceState(
        { ...window.history.state, velliraOAuthError: errorCode },
        '',
        window.location.pathname
      );
      clearOAuthPreferenceIntent();
      const failure = getOAuthCallbackFailure(errorCode, provider);
      if (connection && !invalidProvider) {
        if (errorCode === 'account_link_required') {
          router.replace(connectionHref(connection));
          return;
        }
        failure.primary = {
          href: connectionHref(connection),
          label: 'Return to connection',
        };
      }
      setFailure(failure);
      return;
    }

    let active = true;
    void getMe()
      .then((me) => {
        if (!me.user?.id || me.user.status !== 'active')
          throw new Error('Invalid session response');
        if (active) {
          completeOAuthPreference(provider);
          router.replace(connection ? connectionHref(connection) : '/app');
        }
      })
      .catch(() => {
        if (active) {
          clearOAuthPreferenceIntent();
          const failure = getOAuthCallbackFailure(
            'oauth_unavailable',
            provider
          );
          if (connection)
            failure.primary = {
              href: connectionHref(connection),
              label: 'Return to connection',
            };
          setFailure(failure);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!failure) {
    return (
      <p className={styles.message} role='status'>
        Finishing sign in…
      </p>
    );
  }

  return (
    <div className={styles.actions}>
      <p className={styles.error} role='alert'>
        {failure.message}
      </p>
      <Button asChild>
        <Link href={failure.primary.href}>{failure.primary.label}</Link>
      </Button>
      {failure.secondary && (
        <Button asChild appearance='outline' color='neutral'>
          <Link href={failure.secondary.href}>{failure.secondary.label}</Link>
        </Button>
      )}
    </div>
  );
}
