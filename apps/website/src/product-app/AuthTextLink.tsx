'use client';

import type { ReactNode } from 'react';

import {
  DesignSystemLink,
  type DesignSystemLinkProps,
} from '@/components/navigation/DesignSystemLink';

type AuthTextLinkProps = {
  href: string;
  children: ReactNode;
  iconStart?: ReactNode;
  target?: DesignSystemLinkProps['target'];
  rel?: DesignSystemLinkProps['rel'];
};

export function AuthTextLink({
  href,
  children,
  iconStart,
  target,
  rel,
}: AuthTextLinkProps) {
  return (
    <DesignSystemLink
      href={href}
      iconStart={iconStart}
      target={target}
      rel={rel}
    >
      {children}
    </DesignSystemLink>
  );
}
