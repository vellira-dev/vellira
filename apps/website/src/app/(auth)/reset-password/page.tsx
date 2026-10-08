import { AuthSurface } from '@/product-app/AuthSurface';
import { ResetPasswordForm } from '@/product-app/AuthFlows';

export default function ResetPasswordPage() {
  return (
    <AuthSurface
      title='Choose a new password'
      description='Reset links are single-use and expire automatically.'
    >
      <ResetPasswordForm />
    </AuthSurface>
  );
}
