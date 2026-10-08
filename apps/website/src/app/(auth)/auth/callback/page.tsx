import { AuthSurface } from '@/product-app/AuthSurface';
import { OAuthCallback } from '@/product-app/AuthFlows';

export default function AuthCallbackPage() {
  return (
    <AuthSurface
      title='Finishing sign in'
      description='Vellira is confirming the session created by GitHub sign in.'
    >
      <OAuthCallback />
    </AuthSurface>
  );
}
