import type { ReactNode } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import styles from './HeaderChrome.module.css';

/** Shared structural header, not an additional website header variant.
 * SiteHeader and AppHeader are the only navigation-header owners.
 */
export function HeaderChrome({
  brandHref,
  children,
  headerClassName,
  dataProductAppHeader = false,
}: {
  brandHref: string;
  children: ReactNode;
  headerClassName?: string;
  dataProductAppHeader?: boolean;
}) {
  return (
    <header
      className={[styles.header, headerClassName].filter(Boolean).join(' ')}
      data-product-app-header={dataProductAppHeader ? '' : undefined}
    >
      <div className={styles.container}>
        <Link
          href={brandHref}
          className={styles.brand}
          aria-label='Vellira home'
        >
          <Image
            src='/brand/logos/logo-gradient.svg'
            alt='Vellira'
            width={100}
            height={32}
            preload
          />
        </Link>
        <div className={styles.actions}>{children}</div>
      </div>
    </header>
  );
}
