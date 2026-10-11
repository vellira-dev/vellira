import { getAuthProviders } from '@/product-app/api';
import { AuthLegalFooter } from '@/product-app/AuthLegalFooter';
import { AuthSurface } from '@/product-app/AuthSurface';
import { SignupForm } from '@/product-app/AuthFlows';
import { AuthTextLink } from '@/product-app/AuthTextLink';

export default async function SignupPage() {
  return (
    <AuthSurface
      title='Create your Vellira account'
      description='Choose a provider or use your email and password.'
      footer={
        <>
          Already have an account?{' '}
          <AuthTextLink href='/login'>Sign in</AuthTextLink>
          <AuthLegalFooter />
        </>
      }
    >
      <SignupForm providers={await getAuthProviders()} />
    </AuthSurface>
  );
}
