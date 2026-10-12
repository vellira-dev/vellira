import type { Metadata } from 'next';

import { SettingsGeneral } from '@/product-app/AccountSettings';

export const metadata: Metadata = {
  title: 'Billing | Vellira',
  robots: { index: false, follow: false },
};

export default function VelliraBillingSettingsPage() {
  return <SettingsGeneral section='billing' />;
}
