'use client';

import Link from 'next/link';
import { ArrowLeft } from '@vellira-ui/icons';
import { useComponentNavigation } from '../ComponentNavigationProvider';
import { Container } from '@/components/layout/Container';

import styles from './ComponentsPageHero.module.css';

export function ComponentsPageHero() {
  const { fromWorkspace } = useComponentNavigation();

  return (
    <header className={styles.root}>
      <Container size='wide'>
        <div className={styles.content}>
          {fromWorkspace && (
            <Link className={styles.mobileWorkspaceReturn} href='/app'>
              <ArrowLeft size={16} aria-hidden='true' />
              <span>Back to workspace</span>
            </Link>
          )}
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
