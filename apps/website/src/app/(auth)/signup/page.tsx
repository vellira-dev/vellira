import Link from 'next/link';

import { AuthSurface } from '@/product-app/AuthSurface';
import { SignupForm } from '@/product-app/AuthFlows';

export default function SignupPage() {
  return (
    <AuthSurface
      title='Create your account'
      description='Create a Vellira account or continue with GitHub.'
      footer={
        <>
          Already have an account? <Link href='/login'>Sign in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthSurface>
  );
}
