import type { Metadata } from 'next';

import { NewsletterStatusPage } from '@/components/newsletter/NewsletterStatusPage';

export const metadata: Metadata = {
  title: 'Check your inbox',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewsletterSubscribedPage() {
  return (
    <NewsletterStatusPage
      heading='Check your inbox'
      body='If you receive a confirmation email, follow its link to finish subscribing to Vellira engineering notes. Existing subscribers may not receive another email.'
    />
  );
}
