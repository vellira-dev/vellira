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
      body='We sent you a confirmation email. Confirm your subscription to start receiving Vellira engineering notes.'
    />
  );
}
