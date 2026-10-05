import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';

import styles from './AuthSurface.module.css';

type AuthSurfaceProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthSurface({
  title,
  description,
  children,
  footer,
}: AuthSurfaceProps) {
  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <Link href='/' aria-label='Vellira home'>
          <Image
            src='/brand/logos/logo-gradient.svg'
            alt='Vellira'
            width={100}
            height={32}
            priority
          />
        </Link>
        <ThemeSwitcher />
      </header>

      <main className={styles.main}>
        <section className={styles.panel}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Vellira</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>

          {children}

          {footer && <footer className={styles.footer}>{footer}</footer>}
        </section>
      </main>
    </div>
  );
}
