// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SubscribedPage, {
  metadata as subscribedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/subscribed/page';
import ConfirmedPage, {
  metadata as confirmedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/confirmed/page';
import { BlogIndex } from '../../apps/website/src/blog/ui';

afterEach(cleanup);

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

  it('keeps the native Buttondown form contract and embed marker', () => {
    const { container } = render(<BlogIndex articles={[]} />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (!form) return;
    expect(form).toHaveAttribute(
      'action',
      'https://buttondown.com/api/emails/embed-subscribe/vellira'
    );
    expect(form).toHaveAttribute('method', 'post');
    expect(form).toHaveAttribute('novalidate');
    expect(form.querySelector('input[name="email"]')).toHaveAttribute(
      'type',
      'email'
    );
    expect(form.querySelector('input[name="email"]')).toHaveAttribute(
      'autocomplete',
      'email'
    );
    expect(form.querySelector('input[name="embed"]')).toHaveValue('1');
    expect(form.querySelector('input[name="email"]')).toBeRequired();
    expect(form.querySelector('button[type="submit"]')).toHaveTextContent(
      'Subscribe'
    );
    expect(
      screen.getByRole('button', {
        name: 'Newsletter email privacy information',
      })
    ).toBeInTheDocument();
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

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    expect(
      screen.queryByText('Enter a valid email address.')
    ).not.toBeInTheDocument();
  });

  it('allows a valid email to submit through the native POST form', () => {
    const { container } = render(<BlogIndex articles={[]} />);
    const form = container.querySelector('form');
    const input = container.querySelector('input[name="email"]');

    expect(form).not.toBeNull();
    expect(input).not.toBeNull();
    if (!form || !input) return;

    fireEvent.change(input, { target: { value: 'valid@example.com' } });
    const submitEvent = createEvent.submit(form);
    fireEvent(form, submitEvent);

    expect(submitEvent.defaultPrevented).toBe(false);
  });
});
