'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowLeft } from '@vellira-ui/icons';
import { Button, FormField, Input } from '@vellira-ui/react';

import { AuthTextLink } from './AuthTextLink';
import {
  getApiUrl,
  getMe,
  login,
  register,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  verifyEmail,
  VelliraApiError,
} from './api';

import styles from './AuthSurface.module.css';

function genericAuthError(error: unknown, fallback: string) {
  if (error instanceof VelliraApiError && error.code === 'rate_limited') {
    return 'Too many requests. Please try again shortly.';
  }

  return fallback;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      router.replace('/app');
    } catch (cause) {
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
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          type='submit'
          loading={submitting}
          loadingText='Signing in…'
          disabled={submitting}
        >
          Sign in
        </Button>

        <Button
          type='button'
          appearance='outline'
          color='neutral'
          disabled={submitting}
          onClick={() =>
            window.location.assign(getApiUrl('/v1/auth/oauth/github/start'))
          }
        >
          Continue with GitHub
        </Button>
      </div>

      <div className={styles.secondary}>
        <AuthTextLink href='/forgot-password'>Forgot password?</AuthTextLink>
        <AuthTextLink href='/signup'>Create account</AuthTextLink>
      </div>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [accountExists, setAccountExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(undefined);
    setAccountExists(false);
    setSubmitting(true);

    try {
      await register(email.trim(), password);
      router.replace('/app');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.code === 'account_exists') {
        setAccountExists(true);
        setError('This email already has a Vellira account.');
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
          minLength={12}
          required
          disabled={submitting}
        />
      </FormField>

      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}

      {accountExists && (
        <div className={styles.secondary}>
          <AuthTextLink href='/login'>Sign in</AuthTextLink>
          <AuthTextLink href='/forgot-password'>Forgot password?</AuthTextLink>
        </div>
      )}

      <div className={styles.actions}>
        <Button
          type='submit'
          loading={submitting}
          loadingText='Creating account…'
          disabled={submitting}
        >
          Create account
        </Button>

        <Button
          type='button'
          appearance='outline'
          color='neutral'
          disabled={submitting}
          onClick={() =>
            window.location.assign(getApiUrl('/v1/auth/oauth/github/start'))
          }
        >
          Continue with GitHub
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
        'If this account can be verified, a new verification email has been ' +
          'sent.'
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
          If this account is eligible for password recovery, a reset email has
          been sent.
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
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [ready, setReady] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const nextToken = fragment.get('token');

    window.history.replaceState(null, '', window.location.pathname);
    setToken(nextToken);
    setReady(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !token) return;

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
          This reset link is missing or invalid.
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
          minLength={12}
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

function getOAuthCallbackFailure(code: string): OAuthCallbackFailure {
  switch (code) {
    case 'rate_limited':
      return {
        message:
          'Too many sign-in attempts. Please wait a minute and try again.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'account_link_required':
      return {
        message:
          'A Vellira account already exists for the email verified by GitHub. Sign in with your email and password, or reset your password if needed.',
        primary: { href: '/login', label: 'Sign in with email' },
        secondary: { href: '/forgot-password', label: 'Reset password' },
      };
    case 'oauth_cancelled':
      return {
        message: 'GitHub sign in was cancelled.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'oauth_identity_ineligible':
      return {
        message:
          'GitHub sign in requires a verified primary email on your GitHub account.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'account_disabled':
      return {
        message: 'This Vellira account is currently unavailable.',
        primary: { href: '/login', label: 'Back to sign in' },
      };
    case 'oauth_invalid':
      return {
        message:
          'This GitHub sign-in attempt expired or could not be verified. Please try again.',
        primary: { href: '/login', label: 'Try again' },
      };
    default:
      return {
        message: 'GitHub sign in is temporarily unavailable. Please try again.',
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
    const input =
      params.size || window.location.hash
        ? errors.length === 1 && errors[0]
          ? errors[0]
          : 'oauth_invalid'
        : window.history.state?.velliraOAuthError;

    if (input !== undefined && input !== null) {
      const errorCode = [
        'account_link_required',
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
      setFailure(getOAuthCallbackFailure(errorCode));
      return;
    }

    let active = true;
    void getMe()
      .then(() => {
        if (active) router.replace('/app');
      })
      .catch(() => {
        if (active) setFailure(getOAuthCallbackFailure('oauth_unavailable'));
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (!failure) {
    return (
      <p className={styles.message} role='status'>
        Finishing GitHub sign in…
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
