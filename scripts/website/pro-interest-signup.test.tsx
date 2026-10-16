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

import { ProInterestSignup } from '../../apps/website/src/sections/home/Pro/ProInterestSignup';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function formControls() {
  return {
    form: document.querySelector('form')!,
    email: screen.getByRole('textbox', { name: 'Email address' }),
    consent: screen.getByRole('checkbox', {
      name: /I agree to receive Vellira engineering notes/i,
    }),
    submit: screen.getByRole('button', { name: 'Keep me posted' }),
  };
}

describe('Pro launch-interest consent', () => {
  it('renders one non-prechecked, explicitly labelled Vellira checkbox', () => {
    render(<ProInterestSignup />);
    const { email, consent, submit } = formControls();

    expect(email).toBeRequired();
    expect(consent).toBeRequired();
    expect(consent).not.toBeChecked();
    expect(submit).toBeEnabled();
    expect(
      screen.getByText(/one Vellira newsletter, managed by Buttondown/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/No pre-order or payment/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('never calls the provider route when consent is unchecked', async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    render(<ProInterestSignup />);
    const { email, form, consent } = formControls();

    fireEvent.change(email, { target: { value: 'interested@example.com' } });
    fireEvent.submit(form);

    expect(fetcher).not.toHaveBeenCalled();
    expect(
      screen.getByText('Please confirm that you want Vellira email updates.')
    ).toBeInTheDocument();
    expect(consent).toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(consent);
    expect(consent).toBeChecked();
    expect(
      screen.queryByText('Please confirm that you want Vellira email updates.')
    ).not.toBeInTheDocument();
    fireEvent.click(consent);
    expect(consent).not.toBeChecked();
    fireEvent.submit(form);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects invalid emails even with checked consent', () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    render(<ProInterestSignup />);
    const { email, form, consent } = formControls();

    fireEvent.click(consent);
    fireEvent.change(email, { target: { value: 'invalid-email' } });
    fireEvent.submit(form);
    expect(
      screen.getByText('Enter a valid email address.')
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends Pro purpose and checked consent only after opt-in', async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }, { status: 201 })
    );
    vi.stubGlobal('fetch', fetcher);
    render(<ProInterestSignup />);
    const { email, form, consent } = formControls();

    fireEvent.change(email, {
      target: { value: '  Interested@Example.com  ' },
    });
    fireEvent.click(consent);
    fireEvent.submit(form);

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith(
      '/api/newsletter/subscribe',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'Interested@Example.com',
          purpose: 'pro_launch',
          consent: true,
        }),
        cache: 'no-store',
      })
    );
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'No subscription is confirmed'
      );
    });
    expect(
      screen.queryByRole('textbox', { name: 'Email address' })
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('interested@example.com');
  });

  it('prevents duplicate requests and shows only safe errors', async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetcher = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );
    vi.stubGlobal('fetch', fetcher);
    render(<ProInterestSignup />);
    const { email, form, consent } = formControls();

    fireEvent.change(email, { target: { value: 'interested@example.com' } });
    fireEvent.click(consent);
    fireEvent.submit(form);
    expect(form).toHaveAttribute('aria-busy', 'true');
    expect(consent).toBeDisabled();
    expect(email).toBeDisabled();
    fireEvent.submit(form);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveResponse?.(
      Response.json(
        {
          ok: false,
          code: 'rate_limited',
          message: 'private provider details',
        },
        { status: 429 }
      )
    );
    await waitFor(() => {
      expect(
        screen.getByText('Please wait a few minutes and try again.')
      ).toBeInTheDocument();
      expect(form).toHaveAttribute('aria-busy', 'false');
      expect(consent).toBeEnabled();
    });
    expect(
      screen.queryByText('private provider details')
    ).not.toBeInTheDocument();
  });
});
