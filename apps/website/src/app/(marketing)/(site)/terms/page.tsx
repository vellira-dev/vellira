import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';
export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms for the Vellira website and early account features.',
  alternates: { canonical: '/terms' },
};
export default function TermsPage() {
  return (
    <LegalDocument
      title='Terms of Service'
      description='These terms cover the Vellira website and the early account features available on it.'
    >
      <section aria-labelledby='terms-operator'>
        <h2 id='terms-operator'>Operator and service status</h2>
        <p>
          Vellira is an independent software project operated by Roman Bakurov
          in France. A registered business entity has not yet been created. The
          current service is pre-commercial; these terms do not offer a paid
          subscription or promise future features.
        </p>
        <p>
          Questions about these terms or your account can be sent to{' '}
          <DesignSystemLink href='mailto:roman@vellira.dev'>
            roman@vellira.dev
          </DesignSystemLink>
          .
        </p>
      </section>
      <section aria-labelledby='terms-use'>
        <h2 id='terms-use'>Using Vellira</h2>
        <p>
          Use the service lawfully and respect other people&apos;s accounts,
          privacy and intellectual property. Do not attempt unauthorized access,
          interfere with the service, distribute malicious content or use it to
          send unsolicited messages. Authorized security testing must stay
          within its agreed scope.
        </p>
      </section>
      <section aria-labelledby='terms-account'>
        <h2 id='terms-account'>Your account</h2>
        <p>
          Provide an email address you control and protect your sign-in methods.
          Provider sign-in takes place with the provider; Vellira will never ask
          you for that provider&apos;s password. Connecting another sign-in
          method requires proof of control and explicit confirmation.
        </p>
        <p>
          You may enter the account area before verifying your email. Some
          sensitive capabilities may require additional verification. If you
          lose access, use the available sign-in or password-recovery options,
          or contact the operator. Do not share passwords, recovery links or
          tokens in a support message.
        </p>
      </section>
      <section aria-labelledby='terms-content'>
        <h2 id='terms-content'>Software and content</h2>
        <p>
          Published software packages and source repositories are governed by
          their own accompanying licenses. These terms do not replace those
          licenses. Website content and brand assets remain subject to their
          respective owners&apos; rights. You retain your rights in content you
          provide.
        </p>
      </section>
      <section aria-labelledby='terms-availability'>
        <h2 id='terms-availability'>Early service availability</h2>
        <p>
          Features may change, be interrupted or be withdrawn while Vellira is
          being developed. No uptime commitment or paid support entitlement is
          offered by these terms. Keep your own copies of important material.
          Access may be restricted to protect users or the service, address
          misuse or comply with applicable requirements.
        </p>
        <p>
          Nothing in these terms is intended to exclude rights or protections
          that cannot lawfully be excluded. Any future paid offering will have
          its own clearly presented commercial terms before purchase.
        </p>
      </section>
      <section aria-labelledby='terms-privacy'>
        <h2 id='terms-privacy'>Privacy and browser storage</h2>
        <p>
          The{' '}
          <DesignSystemLink href='/privacy'>Privacy Policy</DesignSystemLink>{' '}
          explains account and website data processing. The{' '}
          <DesignSystemLink href='/cookies'>Cookie Policy</DesignSystemLink>{' '}
          explains browser storage and your choices. Agreeing to these terms
          does not subscribe you to marketing or enable optional saved sign-in
          preferences.
        </p>
      </section>
      <section aria-labelledby='terms-changes'>
        <h2 id='terms-changes'>Changes and contact</h2>
        <p>
          This page will be updated as the project and its legal status change.
          The date above identifies this version. Contact the operator to raise
          a concern, request account assistance or ask about ending your use of
          the service.
        </p>
      </section>
    </LegalDocument>
  );
}
