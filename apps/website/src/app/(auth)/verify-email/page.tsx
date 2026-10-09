import { AuthSurface } from '@/product-app/AuthSurface';
import { VerificationFlow } from '@/product-app/AuthFlows';

export default function VerifyEmailPage() {
  return (
    <AuthSurface
      title='Check your email'
      description={
        'Verify your email address to finish setting up a password account.'
      }
    >
      <VerificationFlow />
    </AuthSurface>
  );
}
