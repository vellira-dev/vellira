import { getAuthProviders } from '@/product-app/api';
import { AuthSurface } from '@/product-app/AuthSurface';
import { LoginForm } from '@/product-app/AuthFlows';

export default async function LoginPage() {
  return (
    <AuthSurface
      title='Welcome back'
      description='Sign in to your Vellira account.'
      footer={null}
    >
      <LoginForm providers={await getAuthProviders()} />
    </AuthSurface>
  );
}
