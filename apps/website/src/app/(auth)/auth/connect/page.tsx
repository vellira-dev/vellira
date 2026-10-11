import { OAuthConnectionFlow } from '@/product-app/OAuthConnectionFlow';
import { getAuthProviderDiscovery } from '@/product-app/api';

export default async function ConnectAccountPage() {
  const discovery = await getAuthProviderDiscovery();

  return (
    <OAuthConnectionFlow
      providers={discovery.providers}
      recoverProviders={discovery.recoverInBrowser}
    />
  );
}
