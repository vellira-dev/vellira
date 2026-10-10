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
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
import { ResetPasswordForm } from '../../apps/website/src/product-app/AuthFlows';
let responseCode = 'invalid_challenge';
beforeEach(() => {
  window.history.replaceState(
    null,
    '',
    '/reset-password#token=VELLIRA-CANARY-RESET'
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify(
            responseCode === 'success'
              ? { passwordReset: true }
              : { error: { code: responseCode } }
          ),
          {
            status: responseCode === 'success' ? 200 : 400,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    )
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('expired token offers new-link recovery', async () => {
  responseCode = 'invalid_challenge';
  render(<ResetPasswordForm />);
  fireEvent.change(screen.getByLabelText(/New password/), {
    target: { value: 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset password', exact: true })
  );
  await waitFor(() =>
    expect(screen.queryByRole('alert')?.textContent).toBe(
      'This reset link is invalid or has expired.'
    )
  );
  expect(
    screen.queryByRole('link', { name: 'Request another reset link' })
  ).not.toBeNull();
});
it('successful reset clears form and offers normal sign-in', async () => {
  responseCode = 'success';
  render(<ResetPasswordForm />);
  fireEvent.change(screen.getByLabelText(/New password/), {
    target: { value: 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset password', exact: true })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'Sign in', exact: true })
    ).not.toBeNull()
  );
  expect(document.querySelector('input[type=password]')).toBeNull();
  expect(window.location.hash).toBe('');
});
it('token capture survives repeated StrictMode effects', () => {
  render(
    <StrictMode>
      <ResetPasswordForm />
    </StrictMode>
  );
  expect(screen.queryByLabelText(/New password/)).not.toBeNull();
});

it.each([
  '',
  '#token=',
  '#token=first&token=second',
  '#token=' + 'a'.repeat(129),
])('missing or ambiguous authority offers direct recovery (%s)', (fragment) => {
  window.history.replaceState(null, '', '/reset-password' + fragment);
  render(
    <StrictMode>
      <ResetPasswordForm />
    </StrictMode>
  );
  expect(
    screen.getByRole('link', { name: 'Request another reset link' })
  ).toHaveAttribute('href', '/forgot-password');
  expect(screen.queryByLabelText(/New password/)).toBeNull();
  expect(window.location.hash).toBe('');
});
it('refresh after URL scrubbing fails safely with new-link recovery', () => {
  const first = render(<ResetPasswordForm />);
  expect(screen.getByLabelText(/New password/)).toBeInTheDocument();
  first.unmount();
  render(<ResetPasswordForm />);
  expect(
    screen.getByRole('link', { name: 'Request another reset link' })
  ).toHaveAttribute('href', '/forgot-password');
  expect(JSON.stringify(window.history.state)).not.toContain('CANARY');
});
it('temporary failure permits safe retry without exposing the token in URL/storage', async () => {
  responseCode = 'auth_unavailable';
  render(<ResetPasswordForm />);
  fireEvent.change(screen.getByLabelText(/New password/), {
    target: { value: 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset password', exact: true })
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'temporarily unavailable'
    )
  );
  expect(
    screen.getByRole('button', { name: 'Reset password', exact: true })
  ).toBeEnabled();
  expect(window.location.hash + window.location.search).toBe('');
  responseCode = 'success';
  fireEvent.click(
    screen.getByRole('button', { name: 'Reset password', exact: true })
  );
  await screen.findByRole('link', { name: 'Sign in', exact: true });
  expect(document.querySelector('input[type=password]')).toBeNull();
});
