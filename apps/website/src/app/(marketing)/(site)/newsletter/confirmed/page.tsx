import type { Metadata } from 'next';

import { NewsletterStatusPage } from '@/components/newsletter/NewsletterStatusPage';

export const metadata: Metadata = {
  title: 'You’re subscribed',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NewsletterConfirmedPage() {
  return (
    <NewsletterStatusPage
      heading='You’re subscribed'
      body='Thanks for following Vellira. New engineering notes will arrive in your inbox.'
    />
  );
}
