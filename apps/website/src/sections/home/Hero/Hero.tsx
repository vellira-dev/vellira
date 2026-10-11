'use client';

import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import { HeroPreview } from './HeroPreview';

import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.background} aria-hidden='true'>
        <div className={styles.grid} />
        <div className={styles.glowPrimary} />
        <div className={styles.glowSecondary} />
        <div className={styles.glowAccent} />
      </div>

      <div className={styles.content}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>
            React + React Native · Open source
          </span>

          <h1 className={styles.title}>
            Ship UI faster.
            <span>Keep it consistent.</span>
          </h1>

          <p className={styles.description}>
            Building for React web and React Native? Start with reusable
            components, shared design tokens and documented APIs. Vellira also
            brings public quality checks to the work of keeping interfaces
            coherent as teams and AI create more UI.
          </p>

          <div className={styles.actions}>
            <Button asChild>
              <Link href='https://docs.vellira.dev/start/getting-started'>
                Get started
              </Link>
            </Button>

            <Button appearance='outline' color='neutral' asChild>
              <Link href='/components'>Explore components</Link>
            </Button>

            <Button appearance='ghost' color='neutral' asChild>
              <Link href='https://github.com/vellira-dev/vellira'>GitHub</Link>
            </Button>
          </div>
        </div>

        <div className={`${styles.preview} ${styles.previewEnter}`}>
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
