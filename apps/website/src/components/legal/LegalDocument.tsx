import type { ReactNode } from 'react';
import { Container } from '@/components/layout/Container';
import { SiteFooter } from '@/components/layout/SiteFooter';
import styles from './LegalDocument.module.css';

export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <main className={styles.page}>
        <Container size='content'>
          <article className={styles.policy}>
            <header className={styles.hero}>
              <p className={styles.eyebrow}>Legal</p>
              <h1>{title}</h1>
              <p className={styles.lead}>{description}</p>
              <p className={styles.updated}>
                Last updated:{' '}
                <time dateTime='2026-10-10'>October 10, 2026</time>
              </p>
            </header>
            {children}
          </article>
        </Container>
      </main>
      <SiteFooter startSurface='canvas' />
    </>
  );
}
