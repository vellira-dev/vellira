import { AuthLegalFooter } from '@/product-app/AuthLegalFooter';
import { AuthSurface } from '@/product-app/AuthSurface';
import { LoginForm } from '@/product-app/AuthFlows';

export default function LoginPage() {
  return (
    <AuthSurface
      title='Welcome back'
      description='Sign in to your Vellira account.'
      footer={<AuthLegalFooter />}
    >
      <LoginForm />
    </AuthSurface>
  );
}
