// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

import { ForgotPasswordForm } from '../../apps/website/src/product-app/AuthFlows';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code: 'rate_limited' } }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '75',
          },
        })
    )
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('respects bounded server Retry-After for password recovery', async () => {
  render(<ForgotPasswordForm />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
    target: { value: 'security-canary@example.invalid' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Please wait before requesting another reset email.'
  );
  expect(
    screen.getByRole('button', { name: 'Send reset link in 01:15' })
  ).toBeDisabled();
});
