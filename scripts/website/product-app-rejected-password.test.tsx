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
  LoginForm,
  SignupForm,
} from '../../apps/website/src/product-app/AuthFlows';
const password = 'VELLIRA-CANARY-PASSWORD-DO-NOT-LEAK-9e34c2';
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('clears a rejected password from input DOM and focuses actionable error feedback', async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ error: { code: 'invalid_credentials' } }), {
      status: 401,
    })
  );
  render(<LoginForm />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'security-canary@example.invalid' },
  });
  const input = screen.getByLabelText(/^Password/);
  fireEvent.change(input, { target: { value: password } });
  const submit = screen.getByRole('button', { name: 'Sign in' });
  submit.focus();
  fireEvent.click(submit);
  const alert = await screen.findByRole('alert');
  await waitFor(() => expect(alert).toHaveFocus());
  expect(input).toHaveValue('');
  expect(document.body.innerHTML.includes(password)).toBe(false);
  expect(submit).toBeEnabled();
  expect(
    screen.getByRole('link', { name: 'Forgot password?' })
  ).toHaveAttribute('href', '/forgot-password');
});
it.each(['login', 'signup'])(
  'restores keyboard error focus after %s network failure while permitting retry',
  async (mode) => {
    fetchMock.mockRejectedValue(new TypeError('Synthetic offline'));
    const view = render(mode === 'login' ? <LoginForm /> : <SignupForm />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
      target: { value: 'security-canary@example.invalid' },
    });
    const input = screen.getByLabelText(/^Password/);
    fireEvent.change(input, { target: { value: password } });
    const submit = screen.getByRole('button', {
      name: mode === 'login' ? 'Sign in' : 'Create account',
    });
    submit.focus();
    fireEvent.click(submit);
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(input).toHaveValue(password);
    expect(submit).toBeEnabled();
    view.unmount();
    expect(document.body.innerHTML.includes(password)).toBe(false);
  }
);
