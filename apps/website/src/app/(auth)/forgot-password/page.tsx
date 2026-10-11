import { AuthSurface } from '@/product-app/AuthSurface';
import { ForgotPasswordForm } from '@/product-app/AuthFlows';

export default function ForgotPasswordPage() {
  return (
    <AuthSurface
      title='Reset your password'
      description={
        'Enter your account email and we will send a reset link when the ' +
        'account is eligible.'
      }
    >
      <ForgotPasswordForm />
    </AuthSurface>
  );
}
