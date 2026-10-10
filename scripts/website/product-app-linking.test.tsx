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
vi.mock('../../apps/website/src/components/ThemeSwitcher', () => ({
  ThemeSwitcher: () => null,
}));
import { OAuthCallback } from '../../apps/website/src/product-app/AuthFlows';
import { OAuthConnectionFlow } from '../../apps/website/src/product-app/OAuthConnectionFlow';
import {
  prepareOAuthPreference,
  readSavedLoginPreference,
  saveLoginPreference,
} from '../../apps/website/src/product-app/authPreference';
import {
  connectionHref,
  type OAuthConnection,
} from '../../apps/website/src/product-app/oauthConnection';
const id = '00000000-0000-4000-8000-000000000123';
const connection: OAuthConnection = { id, provider: 'github' };
const password = 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2';
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let ready: boolean;
let statusCode: number;
let completeCode: number;
let loginCode: number;
let loggedInAsTarget: boolean;
let calls: {
  path: string;
  method: string;
  body: unknown;
  csrf: string | null;
}[];
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  window.history.replaceState(null, '', connectionHref(connection));
  ready = false;
  statusCode = 200;
  completeCode = 200;
  loginCode = 200;
  loggedInAsTarget = true;
  calls = [];
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname,
      method = init?.method ?? 'GET';
    calls.push({
      path,
      method,
      body: init?.body,
      csrf: new Headers(init?.headers).get('X-CSRF-Token'),
    });
    if (path === '/v1/auth/login') {
      if (loginCode !== 200)
        return response(
          { error: { code: 'invalid_credentials', message: password } },
          loginCode
        );
      ready = loggedInAsTarget;
      return response({ authenticated: true });
    }
    if (path === '/v1/auth/csrf')
      return response({ csrfToken: 'VELLIRA-CANARY-CSRF' });
    if (path === '/v1/me')
      return response({
        user: {
          id: 'canonical-existing-user',
          status: 'active',
          emailVerified: false,
        },
      });
    if (method === 'GET')
      return statusCode === 200
        ? response({ provider: path.split('/')[4], readyToConnect: ready })
        : response(
            {
              error: {
                code: statusCode === 400 ? 'link_invalid' : 'auth_unavailable',
              },
            },
            statusCode
          );
    return completeCode === 200
      ? response({ connected: true })
      : response(
          {
            error: {
              code:
                completeCode === 400
                  ? 'link_invalid'
                  : completeCode === 403
                    ? 'link_authentication_required'
                    : 'auth_unavailable',
            },
          },
          completeCode
        );
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function signIn() {
  fireEvent.change(await screen.findByRole('textbox', { name: 'Email' }), {
    target: { value: 'security-canary@example.invalid' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}
it('hands collision to a bounded connection locator without treating it as authentication', async () => {
  saveLoginPreference('email', 'security-canary@example.invalid');
  prepareOAuthPreference(true);
  window.history.replaceState(
    null,
    '',
    `/auth/callback?error=account_link_required&provider=github&link=${id}&link_provider=github&code=VELLIRA-CANARY-CODE#VELLIRA-CANARY-TOKEN`
  );
  const view = render(
    <StrictMode>
      <OAuthCallback />
    </StrictMode>
  );
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(connectionHref(connection))
  );
  expect(fetchMock).not.toHaveBeenCalled();
  expect(readSavedLoginPreference()?.lastSuccessfulMethod).toBe('email');
  expect(JSON.stringify(window.history.state)).not.toContain('CANARY');
  expect(location.search + location.hash).toBe('');
  view.unmount();
  router.replace.mockClear();
  render(<OAuthCallback />);
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(connectionHref(connection))
  );
});
it('normal linked-provider ownership login returns to explicit confirmation after canonical me', async () => {
  saveLoginPreference('email', 'security-canary@example.invalid');
  prepareOAuthPreference(true);
  window.history.replaceState(
    null,
    '',
    `/auth/callback?provider=google&link=${id}&link_provider=github`
  );
  render(
    <StrictMode>
      <OAuthCallback />
    </StrictMode>
  );
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith(connectionHref(connection))
  );
  expect(readSavedLoginPreference()).toEqual({
    version: 2,
    email: 'security-canary@example.invalid',
    lastSuccessfulMethod: 'google',
  });
  expect(calls.every((c) => c.path === '/v1/me')).toBe(true);
});
it.each(['oauth_cancelled', 'oauth_unavailable'])(
  'failed ownership provider %s returns to the pending connection',
  async (error) => {
    saveLoginPreference('email', 'security-canary@example.invalid');
    prepareOAuthPreference(true);
    window.history.replaceState(
      null,
      '',
      `/auth/callback?error=${error}&provider=google&link=${id}&link_provider=github`
    );
    render(<OAuthCallback />);
    expect(
      await screen.findByRole('link', { name: 'Return to connection' })
    ).toHaveAttribute('href', connectionHref(connection));
    expect(readSavedLoginPreference()?.lastSuccessfulMethod).toBe('email');
    expect(fetchMock).not.toHaveBeenCalled();
  }
);
it.each([
  `provider=github&link=${id}&link=${id}&link_provider=github`,
  `provider=github&link=${id}&link_provider=javascript:evil`,
  'provider=github&link=%2F%2Fevil.invalid&link_provider=github',
  `provider=github&link=${id}&link_provider=github&next=https://evil.invalid`,
])(
  'malformed callback never redirects to an arbitrary destination: %s',
  async (query) => {
    window.history.replaceState(null, '', '/auth/callback?' + query);
    render(<OAuthCallback />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'expired or could not be verified'
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('evil.invalid');
  }
);
it('reuses normal password login, then separately requires an explicit CSRF-protected connection', async () => {
  render(
    <StrictMode>
      <OAuthConnectionFlow />
    </StrictMode>
  );
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
  expect(
    screen.queryByRole('link', { name: 'Create account' })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Forgot password? (new tab)' })
  ).toHaveAttribute('target', '_blank');
  await signIn();
  const connect = await screen.findByRole('button', { name: 'Connect GitHub' });
  expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
    '/v1/auth/login',
  ]);
  expect(document.body.innerHTML).not.toContain(password);
  fireEvent.click(connect);
  expect(
    await screen.findByRole('link', { name: 'Continue to Vellira' })
  ).toHaveAttribute('href', '/app');
  const mutation = calls.find(
    (c) => c.path.endsWith('/link/' + id) && c.method === 'POST'
  );
  expect(mutation).toEqual({
    path: '/v1/auth/oauth/github/link/' + id,
    method: 'POST',
    body: '{}',
    csrf: 'VELLIRA-CANARY-CSRF',
  });
  expect(
    calls.filter((c) => String(c.body).includes(password)).map((c) => c.path)
  ).toEqual(['/v1/auth/login']);
  expect(
    JSON.stringify([localStorage, sessionStorage, history.state])
  ).not.toContain(password);
});
it('another account or rejected password never advances to confirmation', async () => {
  loggedInAsTarget = false;
  render(<OAuthConnectionFlow />);
  await signIn();
  await waitFor(() =>
    expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(1)
  );
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Connect GitHub' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'That sign-in did not confirm the account'
  );
  loginCode = 401;
  await signIn();
  expect(await screen.findByText('Invalid email or password.')).toBeVisible();
  expect(screen.getByLabelText(/^Password/)).toHaveValue('');
  expect(
    calls.some((c) => c.path.includes('/link/') && c.method === 'POST')
  ).toBe(false);
});
it.each(['github', 'google', 'apple'] as const)(
  'confirmation is provider-neutral and never enables unavailable provider buttons: %s',
  async (provider) => {
    ready = true;
    window.history.replaceState(null, '', connectionHref({ id, provider }));
    render(<OAuthConnectionFlow />);
    expect(
      await screen.findByRole('button', {
        name:
          'Connect ' +
          { github: 'GitHub', google: 'Google', apple: 'Apple' }[provider],
      })
    ).toBeEnabled();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(
      screen.queryByRole('button', { name: 'Continue with Google' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue with Apple' })
    ).not.toBeInTheDocument();
  }
);
it.each([400, 403, 503])(
  'failed completion %s has a direct safe recovery',
  async (code) => {
    ready = true;
    completeCode = code;
    render(<OAuthConnectionFlow />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Connect GitHub' })
    );
    expect(await screen.findByRole('alert')).toBeVisible();
    if (code === 400)
      expect(screen.getByRole('link', { name: 'Start again' })).toHaveAttribute(
        'href',
        '/login'
      );
    else if (code === 403)
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    else {
      expect(
        screen.getByRole('button', { name: 'Connect GitHub' })
      ).toBeEnabled();
      completeCode = 200;
      fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }));
      expect(
        await screen.findByRole('link', { name: 'Continue to Vellira' })
      ).toBeVisible();
    }
  }
);
it('status network failure can retry and a refreshed consumed/expired connection offers restart', async () => {
  statusCode = 503;
  const view = render(<OAuthConnectionFlow />);
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  statusCode = 200;
  ready = true;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('button', { name: 'Connect GitHub' })
  ).toBeVisible();
  view.unmount();
  statusCode = 400;
  render(<OAuthConnectionFlow />);
  expect(
    await screen.findByRole('link', { name: 'Start again' })
  ).toBeVisible();
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});
it('storage denial cannot prevent ordinary login and explicit completion', async () => {
  for (const key of ['localStorage', 'sessionStorage'] as const)
    vi.spyOn(window, key, 'get').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError');
    });
  render(<OAuthConnectionFlow />);
  await signIn();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Connect GitHub' })
  );
  expect(
    await screen.findByRole('link', { name: 'Continue to Vellira' })
  ).toBeVisible();
});
it('cancelling offers normal sign-in without any implicit connection mutation', async () => {
  render(<OAuthConnectionFlow />);
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'Cancel connection' })
  ).toHaveAttribute('href', '/login');
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
});
