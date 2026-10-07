import { AuthSurface } from '@/product-app/AuthSurface';
import { SignupForm } from '@/product-app/AuthFlows';
import { AuthTextLink } from '@/product-app/AuthTextLink';

export default function SignupPage() {
  return (
    <AuthSurface
      title='Create your account'
      description='Create a Vellira account or continue with GitHub.'
      footer={
        <>
          Already have an account?{' '}
          <AuthTextLink href='/login'>Sign in</AuthTextLink>
        </>
      }
    >
      <SignupForm />
    </AuthSurface>
  );
}
