// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
import {
  LoginForm,
  SignupForm,
} from '../../apps/website/src/product-app/AuthFlows';
import { getAuthProviders } from '../../apps/website/src/product-app/api';
import { AuthProviders } from '../../apps/website/src/product-app/AuthProviders';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const providers = ['google', 'apple', 'github'] as const;
describe('configured provider-first icon-only authentication', () => {
  for (const Form of [LoginForm, SignupForm]) {
    it(`renders ${Form.name} with short artwork and authoritative accessible names before email`, () => {
      const { container } = render(<Form providers={providers} />);
      const group = screen.getByRole('group', {
        name: 'Continue with a provider',
      });
      const buttons = Array.from(group.querySelectorAll('button'));
      expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
        'Continue with Google',
        'Continue with Apple',
        'Continue with GitHub',
      ]);
      for (const button of buttons) expect(button.textContent).toBe('');
      expect(
        group.compareDocumentPosition(
          screen.getByRole('textbox', { name: /^Email/ })
        ) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
      expect(
        screen.getByRole('checkbox', {
          name: 'Save email and login method on this device',
        })
      ).toBeInTheDocument();
    });
  }
  it.each(providers)(
    'excludes %s from its own connection proof',
    (provider) => {
      render(
        <AuthProviders
          providers={providers}
          remember={false}
          disabled={false}
          onRedirecting={vi.fn()}
          connection={{ id: '00000000-0000-4000-8000-000000000001', provider }}
        />
      );
      expect(
        screen.queryByRole('button', {
          name: `Continue with ${{ google: 'Google', apple: 'Apple', github: 'GitHub' }[provider]}`,
        })
      ).not.toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(2);
    }
  );
  it('provides a focus tooltip without relying on it for the accessible name', async () => {
    render(<LoginForm providers={['github']} />);
    fireEvent.focus(
      screen.getByRole('button', { name: 'Continue with GitHub' })
    );
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Continue with GitHub'
      )
    );
  });
  it.each([
    false,
    [],
    { providers: ['github', 'unknown'] },
    { providers: ['github', 'apple', 'google', 'github'] },
    null,
  ])('fails discovery closed for %j without credentials', async (payload) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetchMock);
    expect(await getAuthProviders()).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/auth/providers'),
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      })
    );
    render(<LoginForm providers={[]} />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.queryByRole('group')).toBeNull();
  });
  it('uses fixed display order and tolerates a discovery outage', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ providers: ['github', 'google', 'apple'] })
          )
        )
        .mockRejectedValueOnce(new Error('offline'))
    );
    expect(await getAuthProviders()).toEqual([...providers]);
    expect(await getAuthProviders()).toEqual([]);
  });
});
