import { getAuthProviderDiscovery } from '@/product-app/api';
import { AuthLegalFooter } from '@/product-app/AuthLegalFooter';
import { AuthSurface } from '@/product-app/AuthSurface';
import { LoginForm } from '@/product-app/AuthFlows';

export default async function LoginPage() {
  const discovery = await getAuthProviderDiscovery();

  return (
    <AuthSurface
      title='Welcome back'
      description='Sign in to your Vellira account.'
      footer={<AuthLegalFooter />}
    >
      <LoginForm
        providers={discovery.providers}
        recoverProviders={discovery.recoverInBrowser}
      />
    </AuthSurface>
  );
}
