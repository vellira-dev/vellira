// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

import SubscribedPage, {
  metadata as subscribedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/subscribed/page';
import ConfirmedPage, {
  metadata as confirmedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/confirmed/page';
import { BlogIndex } from '../../apps/website/src/blog/ui';

afterEach(() => {
  cleanup();
  push.mockReset();
  vi.unstubAllGlobals();
});

describe('newsletter status pages', () => {
  it('renders the immediate post-submit state', () => {
    render(<SubscribedPage />);

    expect(
      screen.getByRole('heading', { name: 'Check your inbox' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/We sent you a confirmation email/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Vellira' })
    ).toHaveAttribute('href', '/blog');
  });

  it('renders the completed double-opt-in state', () => {
    render(<ConfirmedPage />);

    expect(
      screen.getByRole('heading', { name: 'You’re subscribed' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Thanks for following Vellira/)
    ).toBeInTheDocument();
  });

  it.each([
    ['subscribed', subscribedMetadata],
    ['confirmed', confirmedMetadata],
  ])('marks the %s page as noindex and nofollow', (_name, pageMetadata) => {
    expect(pageMetadata).toMatchObject({
      robots: { index: false, follow: false },
    });
  });

  it('uses the same-origin newsletter API and canonical form controls', () => {
    const { container } = render(<BlogIndex articles={[]} />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (!form) return;
    expect(form).toHaveAttribute('novalidate');
    expect(form).not.toHaveAttribute('action');
    expect(form.querySelector('input[name="embed"]')).toBeNull();
    const emailInput = form.querySelector('input[name="email"]');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(emailInput).toBeRequired();
    const emailLabel = form.querySelector(`label[for="${emailInput?.id}"]`);
    expect(emailLabel).toHaveTextContent('Email address');
    expect(emailLabel).not.toHaveTextContent('*');
    expect(form.querySelector('button[type="submit"]')).toHaveTextContent(
      'Subscribe'
    );
    expect(
      screen.getByRole('button', {
        name: 'Newsletter email privacy information',
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {
        name: 'Newsletter email privacy information',
      })
    ).toHaveLength(1);
    const infoTrigger = screen.getByRole('button', {
      name: 'Newsletter email privacy information',
    });
    infoTrigger.focus();
    expect(infoTrigger).toHaveFocus();
    expect(infoTrigger.querySelector('button')).toBeNull();
  });

  it('shows branded validation for an empty email', () => {
    render(<BlogIndex articles={[]} />);
    const form = document.querySelector('form');

    expect(form).not.toBeNull();
    if (!form) return;

    fireEvent.submit(form);

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
  });

  it('shows branded validation for a malformed email and clears it on edit', () => {
    const { container } = render(<BlogIndex articles={[]} />);
    const form = document.querySelector('form');
    const input = container.querySelector('input[name="email"]');

    expect(form).not.toBeNull();
    expect(input).not.toBeNull();
    if (!form || !input) return;

    fireEvent.change(input, { target: { value: 'invalid-email' } });
    expect(input).toHaveValue('invalid-email');
    fireEvent.submit(form);

    expect(
      screen.getByText('Enter a valid email address.')
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/-error/);

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    expect(
      screen.queryByText('Enter a valid email address.')
    ).not.toBeInTheDocument();
  });

  it('submits valid email to the same-origin API and navigates on success', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      void input;
      void init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<BlogIndex articles={[]} />);
    const form = container.querySelector('form');
    const input = container.querySelector('input[name="email"]');

    expect(form).not.toBeNull();
    expect(input).not.toBeNull();
    if (!form || !input) return;

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/newsletter/subscribe',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'valid@example.com' }),
        })
      );
      expect(push).toHaveBeenCalledWith('/newsletter/subscribed');
    });
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain('buttondown.com');
  });

  it('disables duplicate submission while the API request is pending', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      void input;
      void init;
      return new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<BlogIndex articles={[]} />);
    const form = container.querySelector('form');
    const input = container.querySelector('input[name="email"]');

    expect(form).not.toBeNull();
    expect(input).not.toBeNull();
    if (!form || !input) return;

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    fireEvent.submit(form);

    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subscribing' })).toBeDisabled();
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse?.(
      new Response(JSON.stringify({ ok: false, code: 'rate_limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await waitFor(() => {
      expect(form).toHaveAttribute('aria-busy', 'false');
      expect(input).toBeEnabled();
    });
  });

  it('renders a safe API error inline and restores the form', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      void input;
      void init;
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'rate_limited',
          message: 'provider-private-detail',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(<BlogIndex articles={[]} />);
    const form = container.querySelector('form');
    const input = container.querySelector('input[name="email"]');

    expect(form).not.toBeNull();
    expect(input).not.toBeNull();
    if (!form || !input) return;

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText('Please wait a few minutes and try again.')
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText('provider-private-detail')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });
});
