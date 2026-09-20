// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SubscribedPage, {
  metadata as subscribedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/subscribed/page';
import ConfirmedPage, {
  metadata as confirmedMetadata,
} from '../../apps/website/src/app/(marketing)/(site)/newsletter/confirmed/page';
import { BlogIndex } from '../../apps/website/src/blog/ui';

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
    expect(form.querySelector('input[name="email"]')).toHaveAttribute(
      'type',
      'email'
    );
    expect(form.querySelector('input[name="embed"]')).toHaveValue('1');
    expect(form.querySelector('input[name="email"]')).toBeRequired();
    expect(form.querySelector('button[type="submit"]')).toHaveTextContent(
      'Subscribe'
    );
  });
});
