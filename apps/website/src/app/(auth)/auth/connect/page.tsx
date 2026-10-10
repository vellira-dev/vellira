import { OAuthConnectionFlow } from '@/product-app/OAuthConnectionFlow';
import { getAuthProviders } from '@/product-app/api';

export default async function ConnectAccountPage() {
  return <OAuthConnectionFlow providers={await getAuthProviders()} />;
}
