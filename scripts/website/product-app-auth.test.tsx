// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { router } = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import {
  ForgotPasswordForm,
  LoginForm,
  OAuthCallback,
} from '../../apps/website/src/product-app/AuthFlows';

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  window.history.replaceState(null, '', '/auth/callback');
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function respond(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function collision() {
  expect(screen.getByRole('alert')).toHaveTextContent(
    'A Vellira account already exists'
  );
  expect(
    screen.getByRole('link', { name: 'Sign in with email' })
  ).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Reset password' })).toHaveAttribute(
    'href',
    '/forgot-password'
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
}

describe('existing OAuth callback and account recovery', () => {
  it('retains collision recovery across repeated effects, refresh and a restored history entry', () => {
    const nextState = { __NA: true, tree: ['existing-router-state'] };
    window.history.replaceState(
      nextState,
      '',
      '/auth/callback?error=account_link_required&code=private-code#private-token'
    );
    const first = render(
      <StrictMode>
        <OAuthCallback />
      </StrictMode>
    );
    collision();
    expect(window.location.search + window.location.hash).toBe('');
    expect(window.history.state).toEqual({
      ...nextState,
      velliraOAuthError: 'account_link_required',
    });
    const callbackEntry = structuredClone(window.history.state);
    first.unmount();
    const refreshed = render(<OAuthCallback />);
    collision();
    refreshed.unmount();
    window.history.replaceState(null, '', '/login');
    window.history.replaceState(callbackEntry, '', '/auth/callback');
    render(<OAuthCallback />);
    collision();
  });

  it.each([
    ['oauth_cancelled', 'cancelled'],
    ['oauth_invalid', 'expired or could not be verified'],
    ['oauth_identity_ineligible', 'verified primary email'],
    ['account_disabled', 'currently unavailable'],
    ['rate_limited', 'Too many sign-in attempts'],
    ['oauth_unavailable', 'temporarily unavailable'],
    ['https://evil.example/private-token', 'temporarily unavailable'],
  ])(
    'shows bounded recovery for %s without calling the session endpoint',
    (code, message) => {
      window.history.replaceState(
        null,
        '',
        `/auth/callback?error=${encodeURIComponent(code)}&next=https://evil.example`
      );
      render(<OAuthCallback />);
      expect(screen.getByRole('alert')).toHaveTextContent(message);
      expect(screen.getByRole('link')).toHaveAttribute('href', '/login');
      expect(document.body.textContent).not.toContain('evil.example');
      expect(JSON.stringify(window.history.state)).not.toContain(
        'evil.example'
      );
      expect(window.location.search).toBe('');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    }
  );

  it.each([
    '?error=',
    '?error=account_link_required&error=oauth_cancelled',
    '?next=//evil.example',
    '?code=private-code&state=private-state',
    '#token=private-token',
  ])('fails closed for malformed callback %s', (suffix) => {
    window.history.replaceState(null, '', `/auth/callback${suffix}`);
    render(<OAuthCallback />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'could not be verified'
    );
    expect(window.location.search + window.location.hash).toBe('');
    expect(document.body.textContent).not.toContain('private-');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each(['new-canonical-user', 'previously-linked-canonical-user'])(
    'uses only the normal session endpoint for %s',
    async (id) => {
      fetchMock.mockImplementation(async () =>
        respond({ user: { id, status: 'active', emailVerified: true } })
      );
      render(
        <StrictMode>
          <OAuthCallback />
        </StrictMode>
      );
      await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
      expect(router.replace).toHaveBeenCalledWith('/app');
      for (const [url, init] of fetchMock.mock.calls) {
        expect(url).toBe('https://api.vellira.dev/v1/me');
        expect(init).toMatchObject({
          credentials: 'include',
          cache: 'no-store',
        });
      }
    }
  );

  it('renders a safe error when no valid session exists', async () => {
    fetchMock.mockResolvedValue(
      respond(
        {
          error: {
            code: 'unauthenticated',
            message: 'internal-private-detail',
          },
        },
        401
      )
    );
    render(<OAuthCallback />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'temporarily unavailable'
    );
    expect(document.body.textContent).not.toContain('internal-private-detail');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('does not redirect after the callback unmounts', async () => {
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const callback = render(<OAuthCallback />);
    callback.unmount();
    finish(
      respond({
        user: { id: 'canonical-user', status: 'active', emailVerified: true },
      })
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('signs in through the existing password form and API', async () => {
    fetchMock.mockResolvedValue(respond({ authenticated: true }));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email', { exact: false }), {
      target: { value: 'fixture@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password', { exact: false }), {
      target: { value: 'local-fixture-password' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Sign in', exact: true })
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app'));
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vellira.dev/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: 'fixture@example.com',
          password: 'local-fixture-password',
        }),
      })
    );
  });

  it('requests recovery through the existing password-reset form and API', async () => {
    fetchMock.mockResolvedValue(respond({ accepted: true }));
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Email', { exact: false }), {
      target: { value: 'fixture@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If this account is eligible'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vellira.dev/v1/auth/password/forgot',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'fixture@example.com' }),
      })
    );
  });
});
