import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import { AuthSurface } from '@/product-app/AuthSurface';
import { SignupForm } from '@/product-app/AuthFlows';

export default function SignupPage() {
  return (
    <AuthSurface
      title='Create your account'
      description='Create a Vellira account or continue with GitHub.'
      footer={
        <>
          Already have an account?{' '}
          <Button asChild appearance='link' color='primary'>
            <Link href='/login'>Sign in</Link>
          </Button>
        </>
      }
    >
      <SignupForm />
    </AuthSurface>
  );
}
