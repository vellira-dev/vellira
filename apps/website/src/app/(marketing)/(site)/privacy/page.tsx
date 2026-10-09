import type { Metadata } from 'next';

import { Container } from '@/components/layout/Container';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import styles from './PrivacyPage.module.css';

const LAST_UPDATED = '2026-10-05';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'How Vellira handles account data, website analytics, anonymous blog metrics, newsletter subscriptions and privacy requests.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy | Vellira',
    description:
      'How Vellira handles account data, website analytics, anonymous blog metrics, newsletter subscriptions and privacy requests.',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <>
      <main className={styles.page}>
        <Container size='content'>
          <article className={styles.policy}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>Legal</p>
              <h1>Privacy</h1>
              <p className={styles.lead}>
                This page explains how vellira.dev handles information when you
                browse the site, create or use a Vellira account, use blog
                interactions, subscribe to the newsletter or contact Vellira.
              </p>
              <p className={styles.updated}>
                Last updated:{' '}
                <time dateTime={LAST_UPDATED}>October 5, 2026</time>
              </p>
            </header>

            <section aria-labelledby='privacy-operator'>
              <h2 id='privacy-operator'>Who operates Vellira</h2>
              <p>
                Vellira is currently an independent software project operated by
                Roman Bakurov in France. Until a registered business entity is
                created, Roman Bakurov is the operator and data controller for
                the public vellira.dev website.
              </p>
              <p>
                Privacy questions and data requests can be sent to{' '}
                <DesignSystemLink href='mailto:roman@vellira.dev'>
                  roman@vellira.dev
                </DesignSystemLink>
                .
              </p>
            </section>

            <section aria-labelledby='privacy-data'>
              <h2 id='privacy-data'>Information we handle</h2>

              <h3>Website delivery, security and traffic measurement</h3>
              <p>
                Vellira uses Cloudflare to deliver and protect the website.
                Cloudflare may process network and request information such as
                IP address, user agent, request time and requested URL as part
                of its CDN, security and infrastructure services.
              </p>
              <p>
                Cloudflare Web Analytics provides aggregate traffic and
                performance information such as page views, referrers,
                approximate country, device/browser information and Core Web
                Vitals. Vellira does not add a tracking cookie or local-storage
                identifier for Cloudflare Web Analytics, and does not use it for
                advertising or cross-site profiling.
              </p>

              <h3>Anonymous blog views and likes</h3>
              <p>
                When blog metrics are used, Vellira&apos;s backend may issue a
                signed anonymous actor cookie named{' '}
                <code>__Host-vellira_actor</code> in production. Its current
                lifetime is up to 180 days. The cookie is pseudonymous and is
                not an email address, account profile or advertising identifier.
              </p>
              <p>
                It is used to keep anonymous like state consistent, prevent
                repeated same-day views from being counted as new views, and
                support bounded abuse controls. The blog-metrics backend stores
                article identifiers and pseudonymous actor-derived interaction
                records needed to maintain truthful aggregate view and like
                counts.
              </p>

              <h3>Theme preference</h3>
              <p>
                If you choose a website theme, Vellira stores the preference in
                your browser under <code>vellira-website-theme</code> using
                localStorage. This value is used only to remember the selected
                light, dark, system or high-contrast appearance and is not sent
                to an advertising network.
              </p>

              <h3>Vellira accounts and authentication</h3>
              <p>
                If you create or use a Vellira account, Vellira processes the
                account information needed to authenticate you and protect the
                service. This can include your email address, email-verification
                state, a non-reversible password hash for password accounts,
                bounded session records, one-time verification or password-reset
                challenge records, and the identifiers needed to map an optional
                GitHub sign-in to the canonical Vellira account.
              </p>
              <p>
                Raw passwords are not stored. Authentication session,
                verification and reset secrets are stored only in protected or
                one-way forms where applicable. GitHub OAuth access tokens are
                used only during the sign-in exchange and are not the identity
                or product-access authority for Vellira.
              </p>

              <h3>Newsletter</h3>
              <p>
                If you subscribe to Vellira engineering notes, Vellira sends the
                email address you provide and, when available, the client IP
                address to Buttondown from the server. Buttondown is used to
                create and confirm the subscription, deliver newsletter emails,
                manage unsubscribe state and support abuse prevention.
              </p>
              <p>
                Newsletter signup is optional. You can unsubscribe using the
                link in newsletter emails or contact Vellira to request help
                with your subscription.
              </p>

              <h3>Messages you send</h3>
              <p>
                If you contact Vellira by email or another direct channel, the
                contact details and message you provide are processed so the
                request can be read, answered and, where necessary, followed up.
              </p>
            </section>

            <section aria-labelledby='privacy-purposes'>
              <h2 id='privacy-purposes'>Why we use this information</h2>
              <ul>
                <li>to deliver, secure and troubleshoot vellira.dev;</li>
                <li>
                  to understand aggregate website performance and content
                  discovery;
                </li>
                <li>
                  to operate anonymous blog view/like functionality without
                  requiring an account;
                </li>
                <li>
                  to create, authenticate and secure Vellira accounts, including
                  email verification and password recovery;
                </li>
                <li>
                  to provide the newsletter when you explicitly subscribe; and
                </li>
                <li>to respond when you contact Vellira.</li>
              </ul>
              <p>
                Where European data-protection law applies, account processing
                is used to provide the account service you request and to keep
                that service secure. Optional communications rely on your
                request or consent where applicable. Vellira also relies on
                legitimate interests in operating, securing and measuring the
                public service without advertising profiles.
              </p>
            </section>

            <section aria-labelledby='privacy-providers'>
              <h2 id='privacy-providers'>Service providers</h2>
              <p>
                Vellira currently relies on a small set of service providers:
              </p>
              <ul>
                <li>
                  <DesignSystemLink
                    href='https://www.cloudflare.com/web-analytics/'
                    target='_blank'
                    rel='noreferrer noopener'
                  >
                    Cloudflare
                  </DesignSystemLink>{' '}
                  for website delivery, security, infrastructure and Web
                  Analytics;
                </li>
                <li>
                  <DesignSystemLink
                    href='https://resend.com/legal/privacy-policy'
                    target='_blank'
                    rel='noreferrer noopener'
                  >
                    Resend
                  </DesignSystemLink>{' '}
                  for transactional account emails such as verification and
                  password recovery;
                </li>
                <li>
                  <DesignSystemLink
                    href='https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement'
                    target='_blank'
                    rel='noreferrer noopener'
                  >
                    GitHub
                  </DesignSystemLink>{' '}
                  when you choose GitHub as an optional sign-in provider;
                </li>
                <li>
                  <DesignSystemLink
                    href='https://www.buttondown.com/legal/privacy'
                    target='_blank'
                    rel='noreferrer noopener'
                  >
                    Buttondown
                  </DesignSystemLink>{' '}
                  for newsletter subscription and email delivery;
                </li>
                <li>
                  <DesignSystemLink
                    href='https://render.com/privacy'
                    target='_blank'
                    rel='noreferrer noopener'
                  >
                    Render
                  </DesignSystemLink>{' '}
                  for backend/database infrastructure used by Vellira services,
                  including account authentication and blog metrics.
                </li>
              </ul>
              <p>
                These providers may process information in countries outside
                France or the European Economic Area. Their own privacy terms
                describe their processing locations and transfer safeguards.
              </p>
            </section>

            <section aria-labelledby='privacy-retention'>
              <h2 id='privacy-retention'>Retention and browser storage</h2>
              <ul>
                <li>
                  The anonymous blog actor cookie currently expires after up to
                  180 days.
                </li>
                <li>
                  The theme preference stays in localStorage until you change
                  it, clear site data or remove it in your browser.
                </li>
                <li>
                  Aggregate blog counters are kept so published view and like
                  totals remain consistent. Pseudonymous interaction records are
                  kept only as needed to operate those metrics and related abuse
                  controls.
                </li>
                <li>
                  Account identity and authentication records are kept while
                  needed to operate and secure the account. Session and one-time
                  authentication records use bounded expiry/revocation rules and
                  are retained only as needed for security, recovery and
                  operational integrity.
                </li>
                <li>
                  Newsletter subscriber data is kept while the subscription is
                  active and as needed to honor unsubscribe state, deletion
                  requests and provider/legal retention requirements.
                </li>
                <li>
                  Direct correspondence is kept only as long as reasonably
                  needed to handle the conversation and related follow-up.
                </li>
              </ul>
            </section>

            <section aria-labelledby='privacy-choices'>
              <h2 id='privacy-choices'>Your choices and rights</h2>
              <p>
                Depending on the law that applies to you, you may have rights to
                access, correct, delete, restrict or object to processing of
                personal data, and in some cases to receive data you provided in
                a portable format. You can also withdraw newsletter consent by
                unsubscribing at any time.
              </p>
              <p>
                Send a request to{' '}
                <DesignSystemLink href='mailto:roman@vellira.dev'>
                  roman@vellira.dev
                </DesignSystemLink>
                .
              </p>
              <p>
                If you are in France, you also have the right to contact the{' '}
                <DesignSystemLink
                  href='https://www.cnil.fr/'
                  target='_blank'
                  rel='noreferrer noopener'
                >
                  CNIL
                </DesignSystemLink>{' '}
                about a data-protection concern.
              </p>
              <p>
                You can clear <code>__Host-vellira_actor</code> and the
                <code> vellira-website-theme</code> preference through your
                browser&apos;s site-data controls. Clearing the anonymous actor
                cookie resets the browser&apos;s anonymous blog-interaction
                continuity.
              </p>
            </section>

            <section aria-labelledby='privacy-no-sale'>
              <h2 id='privacy-no-sale'>
                No advertising profiles or sale of data
              </h2>
              <p>
                Vellira does not sell newsletter addresses or anonymous blog
                interaction data, and does not use the public website to build
                cross-site advertising profiles.
              </p>
            </section>

            <section aria-labelledby='privacy-changes'>
              <h2 id='privacy-changes'>Changes to this policy</h2>
              <p>
                This policy will be updated when Vellira&apos;s legal operator,
                website features, processors or material data practices change.
                The date at the top of this page identifies the current version.
              </p>
            </section>
          </article>
        </Container>
      </main>

      <SiteFooter startSurface='canvas' />
    </>
  );
}
