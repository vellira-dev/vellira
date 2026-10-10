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
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { router } = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
import {
  LoginForm,
  SignupForm,
  OAuthCallback,
} from '../../apps/website/src/product-app/AuthFlows';
import { useWebsiteTheme } from '../../apps/website/src/hooks/useWebsiteTheme';
import {
  clearLoginPreference,
  completeOAuthPreference,
  prepareOAuthPreference,
  readSavedLoginPreference,
  saveLoginPreference,
} from '../../apps/website/src/product-app/authPreference';
const key = 'vellira-auth-login-preference';
const canaryEmail = 'security-canary@example.invalid';
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
function response(status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? {
            user: {
              id: 'canonical-user',
              status: 'active',
              emailVerified: false,
            },
            authenticated: true,
          }
        : { error: { code: 'unauthenticated' } }
    ),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/login');
  fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => response());
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it.each([
  '{',
  'null',
  '[]',
  '{"version":99}',
  '{"version":2,"lastSuccessfulMethod":"attacker"}',
  '{"method":{}}',
])('fails closed on malformed preference %s', (raw) => {
  localStorage.setItem(key, raw);
  expect(readSavedLoginPreference()).toBeNull();
});
it.each(['email', 'github', 'google', 'apple'] as const)(
  'persists only bounded independent fields after successful %s',
  (method) => {
    saveLoginPreference(method, canaryEmail);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({
      version: 2,
      email: canaryEmail,
      lastSuccessfulMethod: method,
    });
    expect(Object.keys(readSavedLoginPreference()!).sort()).toEqual([
      'email',
      'lastSuccessfulMethod',
      'version',
    ]);
  }
);
it('never treats a legacy clicked provider as successful', () => {
  localStorage.setItem(
    key,
    JSON.stringify({ method: 'github', email: canaryEmail })
  );
  expect(readSavedLoginPreference()).toEqual({
    version: 2,
    email: canaryEmail,
  });
});
it('ignores oversized emails on both read and write', () => {
  saveLoginPreference('email', 'a'.repeat(10000));
  expect(readSavedLoginPreference()).toEqual({
    version: 2,
    lastSuccessfulMethod: 'email',
  });
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 2,
      email: 'a'.repeat(10000),
      lastSuccessfulMethod: 'github',
    })
  );
  expect(readSavedLoginPreference()).toBeNull();
});
it.each([
  'oauth_cancelled',
  'oauth_unavailable',
  'account_link_required',
  'oauth_invalid',
])('does not promote GitHub on %s or erase saved email', (error) => {
  saveLoginPreference('google', canaryEmail);
  prepareOAuthPreference(true);
  expect(readSavedLoginPreference()?.lastSuccessfulMethod).toBe('google');
  window.history.replaceState(
    null,
    '',
    '/auth/callback?provider=github&error=' + error
  );
  render(
    <StrictMode>
      <OAuthCallback />
    </StrictMode>
  );
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(readSavedLoginPreference()).toEqual({
    version: 2,
    email: canaryEmail,
    lastSuccessfulMethod: 'google',
  });
  expect(sessionStorage.length).toBe(0);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(['github', 'google', 'apple'] as const)(
  'records %s only after canonical session proof and preserves email',
  async (provider) => {
    saveLoginPreference('email', canaryEmail);
    prepareOAuthPreference(true);
    expect(readSavedLoginPreference()?.lastSuccessfulMethod).toBe('email');
    window.history.replaceState(
      null,
      '',
      '/auth/callback?provider=' + provider
    );
    render(
      <StrictMode>
        <OAuthCallback />
      </StrictMode>
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app'));
    expect(readSavedLoginPreference()).toEqual({
      version: 2,
      email: canaryEmail,
      lastSuccessfulMethod: provider,
    });
    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).toBe('');
  }
);
it.each([401, 503])(
  'does not record a method when /me rejects with %s',
  async (status) => {
    saveLoginPreference('email', canaryEmail);
    prepareOAuthPreference(true);
    fetchMock.mockResolvedValue(response(status));
    window.history.replaceState(null, '', '/auth/callback?provider=github');
    render(<OAuthCallback />);
    await screen.findByRole('alert');
    expect(readSavedLoginPreference()?.lastSuccessfulMethod).toBe('email');
    expect(sessionStorage.length).toBe(0);
  }
);
it.each([
  '?provider=javascript%3Aevil',
  '?provider=github&provider=google',
  '?provider=github&code=VELLIRA-CANARY-CODE',
  '?provider=github&state=VELLIRA-CANARY-STATE',
])('rejects malformed success callback %s', (query) => {
  prepareOAuthPreference(true);
  window.history.replaceState(null, '', '/auth/callback' + query);
  render(<OAuthCallback />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  expect(window.location.search).toBe('');
  expect(JSON.stringify(window.history.state)).not.toContain('CANARY');
});
it('does not persist without opt-in or after expired pending intent', async () => {
  prepareOAuthPreference(false);
  window.history.replaceState(null, '', '/auth/callback?provider=github');
  render(<OAuthCallback />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app'));
  expect(localStorage.getItem(key)).toBeNull();
  prepareOAuthPreference(true);
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 16 * 60 * 1000);
  completeOAuthPreference('github');
  expect(localStorage.getItem(key)).toBeNull();
});
it('prefills email independently of the last provider, and opt-out clears both', () => {
  saveLoginPreference('github', canaryEmail);
  render(<LoginForm providers={['github']} />);
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
    canaryEmail
  );
  expect(
    screen.getByRole('button', { name: /Continue with GitHub/ })
  ).toBeEnabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(localStorage.getItem(key)).toBeNull();
  expect(screen.queryByRole('button', { name: /Last used/ })).toBeNull();
});
function ThemeAndAuth({ signup = false }: { signup?: boolean }) {
  const theme = useWebsiteTheme();
  return (
    <>
      <button onClick={() => theme.setPreference('dark')}>Change theme</button>
      {signup ? <SignupForm /> : <LoginForm providers={['github']} />}
    </>
  );
}
it.each([false, true])(
  'storage getters throwing cannot break theme/auth rendering or password submit (signup=%s)',
  async (signup) => {
    for (const storage of ['localStorage', 'sessionStorage'] as const)
      vi.spyOn(window, storage, 'get').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    render(<ThemeAndAuth signup={signup} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change theme' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: canaryEmail },
    });
    fireEvent.change(screen.getByLabelText(/^Password/), {
      target: { value: 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', {
        name: signup ? 'Create account' : 'Sign in',
      })
    );
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app'));
    expect(() => prepareOAuthPreference(true)).not.toThrow();
  }
);
it('storage denial cannot prevent callback completion', async () => {
  for (const storage of ['localStorage', 'sessionStorage'] as const)
    vi.spyOn(window, storage, 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
  window.history.replaceState(null, '', '/auth/callback?provider=github');
  render(<OAuthCallback />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/app'));
});
it('quota and operation errors fail soft', () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const)
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
  expect(readSavedLoginPreference()).toBeNull();
  expect(() => {
    saveLoginPreference('email', canaryEmail);
    prepareOAuthPreference(true);
    completeOAuthPreference('github');
    clearLoginPreference();
  }).not.toThrow();
});
