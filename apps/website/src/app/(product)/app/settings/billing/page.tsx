import type { Metadata } from 'next';

import { BillingSettings } from '@/product-app/BillingSettings';

export const metadata: Metadata = {
  title: 'Billing | Vellira',
  robots: { index: false, follow: false },
};

export default function VelliraBillingSettingsPage() {
  return <BillingSettings />;
}
