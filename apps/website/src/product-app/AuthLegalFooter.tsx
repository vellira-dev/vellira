import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';
export function AuthLegalFooter() {
  return (
    <p>
      By continuing, you agree to Vellira&apos;s{' '}
      <DesignSystemLink
        href='/terms'
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Terms of Service (opens in a new tab)'
      >
        Terms of Service
      </DesignSystemLink>
      ,{' '}
      <DesignSystemLink
        href='/privacy'
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Privacy Policy (opens in a new tab)'
      >
        Privacy Policy
      </DesignSystemLink>
      , and{' '}
      <DesignSystemLink
        href='/cookies'
        target='_blank'
        rel='noopener noreferrer'
        aria-label='Cookie Policy (opens in a new tab)'
      >
        Cookie Policy
      </DesignSystemLink>
      .
    </p>
  );
}
