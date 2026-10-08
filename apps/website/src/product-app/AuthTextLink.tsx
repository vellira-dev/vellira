'use client';

import type { ReactNode } from 'react';

import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

type AuthTextLinkProps = {
  href: string;
  children: ReactNode;
  iconStart?: ReactNode;
};

export function AuthTextLink({ href, children, iconStart }: AuthTextLinkProps) {
  return (
    <DesignSystemLink href={href} iconStart={iconStart}>
      {children}
    </DesignSystemLink>
  );
}
