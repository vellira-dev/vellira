'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { Button } from '@vellira-ui/react';

type AuthTextLinkProps = {
  href: string;
  children: ReactNode;
  iconStart?: ReactNode;
};

export function AuthTextLink({
  href,
  children,
  iconStart,
}: AuthTextLinkProps) {
  return (
    <Button
      asChild
      appearance='link'
      color='primary'
      iconStart={iconStart}
    >
      <Link href={href}>{children}</Link>
    </Button>
  );
}
