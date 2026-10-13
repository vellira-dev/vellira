'use client';

import { Container } from '@/components/layout/Container';

import styles from './ComponentsPageHero.module.css';

export function ComponentsPageHero() {
  return (
    <header className={styles.root}>
      <Container size='wide'>
        <div className={styles.content}>
          <div className={styles.eyebrow}>Components</div>

          <h1 className={styles.title}>Components</h1>

          <p className={styles.description}>
            Accessible, production-ready building blocks for React and React
            Native.
          </p>
        </div>
      </Container>
    </header>
  );
}
