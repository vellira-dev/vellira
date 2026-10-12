import { SettingsGeneral } from '@/product-app/AccountSettings';

type SettingsPageProps = {
  searchParams: Promise<{ section?: string | string[] }>;
};

export default async function VelliraSettingsPage({
  searchParams,
}: SettingsPageProps) {
  const { section: requested } = await searchParams;
  const section =
    requested === 'security' ||
    requested === 'workspace' ||
    requested === 'appearance'
      ? requested
      : 'account';

  return <SettingsGeneral section={section} />;
}
