// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
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
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/app',
}));
vi.mock('../../apps/website/src/components/ThemeSwitcher', () => ({
  ThemeSwitcher: () => null,
}));
import { AppShell } from '../../apps/website/src/product-app/AppShell';

let verified = false;
let meCalls = 0;
let resendStatus = 200;
let refreshStatus = 200;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
function response(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
beforeEach(() => {
  verified = false;
  meCalls = 0;
  resendStatus = 200;
  refreshStatus = 200;
  fetchMock = vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path === '/v1/me') {
      meCalls++;
      return meCalls > 1 && refreshStatus !== 200
        ? response(
            {
              error: {
                code:
                  refreshStatus === 401
                    ? 'unauthenticated'
                    : 'auth_unavailable',
              },
            },
            refreshStatus
          )
        : response({
            user: {
              id: 'canonical-user',
              status: 'active',
              emailVerified: verified,
            },
          });
    }
    if (path === '/v1/workspaces')
      return response({
        workspaces: [
          {
            id: 'workspace',
            name: 'Personal',
            status: 'active',
            membership: { role: 'owner' },
          },
        ],
      });
    if (path === '/v1/auth/csrf')
      return response({ csrfToken: 'VELLIRA-CANARY-CSRF' });
    if (path === '/v1/auth/email/resend/current')
      return response(
        resendStatus === 200
          ? { accepted: true }
          : {
              error: {
                code:
                  resendStatus === 429 ? 'rate_limited' : 'auth_unavailable',
              },
            },
        resendStatus
      );
    throw new Error('Unexpected request');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('refreshes canonical verification after another tab verifies, without optimistic local authority', async () => {
  render(
    <AppShell>
      <p>Product access</p>
    </AppShell>
  );
  const resend = await screen.findByRole('button', {
    name: 'Resend verification email',
  });
  expect(screen.getByText('Product access')).toBeInTheDocument();
  verified = true; // A separate browser has committed verification server-side.
  fireEvent.click(resend);
  await waitFor(() => expect(meCalls).toBe(2));
  await screen.findByText('Product access');
  expect(screen.queryByText('Email not verified')).toBeNull();
  expect(
    fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/resend/current')
    )
  ).toHaveLength(1);
});

it('keeps an unverified account usable and describes accepted resend without claiming delivery', async () => {
  render(
    <AppShell>
      <p>Product access</p>
    </AppShell>
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Resend verification email' })
  );
  await screen.findByText(
    'If verification is still needed, check your inbox for a new verification email.'
  );
  expect(meCalls).toBe(2);
  expect(screen.getByText('Email not verified')).toBeInTheDocument();
  expect(screen.queryByText('Verification email sent.')).toBeNull();
});

it.each([429, 503])(
  'offers retry on resend %s without claiming delivery or verification',
  async (status) => {
    resendStatus = status;
    render(
      <AppShell>
        <p>Product access</p>
      </AppShell>
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resend verification email' })
    );
    await screen.findByRole('alert');
    expect(meCalls).toBe(1);
    expect(screen.getByText('Email not verified')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resend verification email' })
    ).toBeEnabled();
  }
);

it('preserves canonical retry recovery when the post-resend account refresh is unavailable', async () => {
  refreshStatus = 503;
  render(
    <AppShell>
      <p>Product access</p>
    </AppShell>
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Resend verification email' })
  );
  await screen.findByRole('button', { name: 'Try again' });
  expect(router.replace).not.toHaveBeenCalled();
  refreshStatus = 200;
  verified = true;
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Product access');
  expect(screen.queryByText('Email not verified')).toBeNull();
});
