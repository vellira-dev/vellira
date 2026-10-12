import type { MouseEventHandler, ReactNode } from 'react';

import Image from 'next/image';
import Link from 'next/link';

import styles from './HeaderChrome.module.css';

/** Same responsive Vellira brand in the site/account headers and the
 * Components/workspace slide-out panels. Its image width is owned by the
 * existing HeaderChrome CSS at every breakpoint, not by each menu.
 */
export function HeaderBrand({
  href,
  className,
  ariaLabel = 'Vellira home',
  onClick,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      className={[styles.brand, className].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <Image
        src='/brand/logos/logo-gradient.svg'
        alt='Vellira'
        width={100}
        height={32}
        preload
      />
    </Link>
  );
}

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
        <HeaderBrand href={brandHref} />
        <div className={styles.actions}>{children}</div>
      </div>
    </header>
  );
}
