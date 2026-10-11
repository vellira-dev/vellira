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
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
import {
  SignupForm,
  ResetPasswordForm,
} from '../../apps/website/src/product-app/AuthFlows';
import { validNewPassword } from '../../apps/website/src/product-app/passwordPolicy';
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  window.history.replaceState(
    null,
    '',
    '/reset-password#token=VELLIRA-CANARY-RESET'
  );
  fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ registered: true, passwordReset: true }), {
        status: 200,
      })
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([
  ['ascii short', 'a'.repeat(11), false],
  ['ascii minimum', 'a'.repeat(12), true],
  ['accents short', 'é'.repeat(6), false],
  ['accents minimum', 'é'.repeat(12), true],
  ['supplementary short', '😀'.repeat(11), false],
  ['supplementary minimum', '😀'.repeat(12), true],
  ['byte maximum', '😀'.repeat(256), true],
  ['byte overflow', '😀'.repeat(257), false],
  ['invalid surrogate', 'a'.repeat(12) + '\uD800', false],
  ['enormous', 'a'.repeat(10000), false],
] as const)('matches backend scalar/byte policy: %s', (_, password, valid) => {
  expect(validNewPassword(password)).toBe(valid);
});
it.each(['signup', 'reset'])(
  '%s exposes live scalar policy and confirmation before submission',
  async (mode) => {
    render(mode === 'signup' ? <SignupForm /> : <ResetPasswordForm />);

    if (mode === 'signup')
      fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
        target: { value: 'security-canary@example.invalid' },
      });

    const passwordLabel = mode === 'signup' ? /^Password\s*\*$/ : /^New password/;
    const confirmationLabel =
      mode === 'signup' ? /^Confirm password/ : /^Confirm new password/;
    const submitName = mode === 'signup' ? 'Create account' : 'Reset password';
    const submit = screen.getByRole('button', { name: submitName });

    fireEvent.change(screen.getByLabelText(passwordLabel), {
      target: { value: '😀'.repeat(6) },
    });

    expect(
      screen.getByRole('listitem', {
        name: 'At least 12 characters: not met',
      })
    ).toBeVisible();
    expect(submit).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(passwordLabel), {
      target: { value: '😀'.repeat(12) },
    });
    fireEvent.change(screen.getByLabelText(confirmationLabel), {
      target: { value: 'different-but-long-enough' },
    });

    expect(
      screen.getByRole('listitem', {
        name: 'At least 12 characters: met',
      })
    ).toBeVisible();
    expect(
      screen.getByRole('listitem', { name: 'Passwords match: not met' })
    ).toBeVisible();
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText(confirmationLabel), {
      target: { value: '😀'.repeat(12) },
    });

    expect(
      screen.getByRole('listitem', { name: 'Passwords match: met' })
    ).toBeVisible();
    expect(submit).toBeEnabled();

    fireEvent.click(submit);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[mode === 'signup' ? 'password' : 'newPassword']).toBe(
      '😀'.repeat(12)
    );
  }
);
