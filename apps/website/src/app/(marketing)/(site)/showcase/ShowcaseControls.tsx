'use client';

import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import { ThemeSwitcher } from '@/components/ThemeSwitcher';

import styles from './showcase.module.css';

export function ShowcaseHeroControls() {
  return (
    <>
      <nav className={styles.actions} aria-label='Showcase steps'>
        <Button asChild appearance='solid' color='primary'>
          <Link href='#platforms'>Try live comparison</Link>
        </Button>
        <Button asChild appearance='outline' color='neutral'>
          <Link href='#code'>Explore example code</Link>
        </Button>
        <Button asChild appearance='ghost' color='neutral'>
          <Link href='#quick-start'>Install Vellira</Link>
        </Button>
      </nav>

      <div className={styles.themeControl}>
        <div>
          <strong>Try a different theme</strong>
          <p>
            The theme selector updates the Web preview and requests a matching
            theme for the browser-hosted Native preview.
          </p>
        </div>
        <ThemeSwitcher />
      </div>
    </>
  );
}

export function ShowcaseFeedbackActions() {
  return (
    <div className={styles.feedbackActions}>
      <Button asChild appearance='solid' color='primary'>
        <a
          href='https://github.com/vellira-dev/vellira/tree/main/examples/cross-platform-form'
          target='_blank'
          rel='noopener noreferrer'
        >
          Open runnable example
        </a>
      </Button>
      <Button asChild appearance='outline' color='neutral'>
        <Link href='/blog/cross-platform-form-vellira'>
          Read the form walkthrough
        </Link>
      </Button>
      <Button asChild appearance='ghost' color='neutral'>
        <a
          href='https://github.com/vellira-dev/vellira/issues/new'
          target='_blank'
          rel='noopener noreferrer'
        >
          Send technical feedback
        </a>
      </Button>
    </div>
  );
}
