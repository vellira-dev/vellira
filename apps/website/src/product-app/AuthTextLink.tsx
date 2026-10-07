import type { ReactNode } from 'react';
import Link from 'next/link';

import styles from './AuthTextLink.module.css';

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
    <Link href={href} className={styles.link}>
      {iconStart && <span className={styles.icon}>{iconStart}</span>}
      <span>{children}</span>
    </Link>
  );
}
