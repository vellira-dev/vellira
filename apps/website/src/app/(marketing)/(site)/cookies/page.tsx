import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';
export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'Cookies and browser storage used by Vellira, and how to manage them.',
  alternates: { canonical: '/cookies' },
};
export default function CookiesPage() {
  return (
    <LegalDocument
      title='Cookie Policy'
      description='This page explains cookies and similar browser storage used by Vellira.'
    >
      <section aria-labelledby='cookies-operator'>
        <h2 id='cookies-operator'>Who operates this website</h2>
        <p>
          Vellira is currently an independent project operated by Roman Bakurov
          in France, before formation of a registered business entity. For data
          questions, contact{' '}
          <DesignSystemLink href='mailto:roman@vellira.dev'>
            roman@vellira.dev
          </DesignSystemLink>{' '}
          and read the{' '}
          <DesignSystemLink href='/privacy'>Privacy Policy</DesignSystemLink>.
        </p>
      </section>
      <section aria-labelledby='cookies-auth'>
        <h2 id='cookies-auth'>Account security and sign-in</h2>
        <p>
          When you sign in, an HttpOnly session cookie keeps your browser
          authenticated. A separate security cookie supports protection against
          forged requests. Sessions have a bounded lifetime, normally 24 hours,
          and may expire sooner when revoked or after password reset. Signing
          out revokes the current session.
        </p>
        <p>
          Provider sign-in and explicit connection use independent, short-lived
          transaction cookies, normally ten minutes. These bind a provider
          response to the browser that started it; they do not contain your
          provider password or access token. The provider sets and manages its
          own cookies on its own site.
        </p>
      </section>
      <section aria-labelledby='cookies-preferences'>
        <h2 id='cookies-preferences'>Preferences you choose</h2>
        <p>
          Your selected theme is stored under <code>vellira-website-theme</code>{' '}
          in localStorage. Choosing &quot;Save email and login method on this
          device&quot; stores only a bounded preference with your saved email,
          when supplied, and last successfully used login method under{' '}
          <code>vellira-auth-login-preference</code>. It does not keep you
          signed in longer or store a password, provider token or session
          secret.
        </p>
        <p>
          A short-lived sessionStorage marker remembers that preference choice
          during a provider redirect. Failed or cancelled sign-in does not
          become &quot;Last used&quot;. Turn the checkbox off to clear the saved
          sign-in preference. Local preferences otherwise remain until changed
          or removed through your browser&apos;s site-data controls.
        </p>
      </section>
      <section aria-labelledby='cookies-blog'>
        <h2 id='cookies-blog'>Blog interactions and measurement</h2>
        <p>
          The pseudonymous blog actor cookie, <code>__Host-vellira_actor</code>{' '}
          in production, lasts up to 180 days. It maintains anonymous like
          state, limits repeated same-day view counting and supports abuse
          controls. Clearing it resets that browser&apos;s interaction
          continuity.
        </p>
        <p>
          Cloudflare delivers and protects the site and may apply its own
          security controls. Vellira does not add advertising cookies,
          cross-site advertising identifiers or a tracking cookie for Cloudflare
          Web Analytics. Aggregate measurement and infrastructure processing are
          described in the Privacy Policy.
        </p>
      </section>
      <section aria-labelledby='cookies-control'>
        <h2 id='cookies-control'>Your controls</h2>
        <p>
          You can review, block or remove cookies and local/session storage in
          your browser. Removing account cookies signs you out; blocking
          required security cookies may prevent authentication. Optional saved
          preferences are not required to sign in, and denied localStorage does
          not make it an authentication authority.
        </p>
        <p>
          The account footer is not consent to advertising or optional tracking.
          Material changes to browser storage practices will be reflected here
          and any required choices will be presented before optional storage is
          used.
        </p>
      </section>
    </LegalDocument>
  );
}
