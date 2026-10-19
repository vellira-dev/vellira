import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { BackToTop } from '@/components/navigation/BackToTop';
import { CodeShowcase } from '@/sections/home/CodeShowcase';
import { PlatformParity } from '@/sections/home/PlatformParity';
import { QuickStart } from '@/sections/home/QuickStart';

import styles from './showcase.module.css';

const description =
  'Try real React and React Native Vellira components, compare synchronized state, inspect example code, and install the open-source packages.';

export const metadata: Metadata = {
  title: 'Interactive React + React Native Showcase',
  description,
  alternates: {
    canonical: '/showcase',
  },
  openGraph: {
    title: 'Interactive React + React Native Showcase | Vellira',
    description,
    url: '/showcase',
  },
};

export default function ShowcasePage() {
  return (
    <>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>Developer showcase</p>
            <h1 className={styles.title}>
              See Vellira in action.
              <span>One UI system. Two runtimes.</span>
            </h1>
            <p className={styles.lead}>
              Type into real React components and watch the browser-hosted
              React Native preview follow the same product state. Compare
              platform-specific code, change the theme, and try the published
              packages in your own project.
            </p>

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
                  The theme selector updates the Web preview and requests a
                  matching theme for the browser-hosted Native preview.
                </p>
              </div>
              <ThemeSwitcher />
            </div>
            <p className={styles.disclaimer}>
              The embedded React Native example uses React Native Web in a
              browser. It is not an iOS or Android device test. Native
              interactions must also be verified in Expo or on a device.
            </p>
          </div>
        </header>

        <PlatformParity />

        <div className={styles.connector}>
          <div className={styles.connectorInner}>
            <span className={styles.eyebrow}>Inspect the code</span>
            <h2>See how the APIs map to each platform.</h2>
            <p>
              The code samples illustrate API concepts. For real integrations,
              use the platform documentation and the runnable form example
              linked below.
            </p>
          </div>
        </div>

        <CodeShowcase />
        <QuickStart />

        <section className={styles.feedback} aria-labelledby='showcase-feedback'>
          <div className={styles.feedbackInner}>
            <p className={styles.eyebrow}>Try it yourself</p>
            <h2 id='showcase-feedback'>What would stop you from using Vellira?</h2>
            <p>
              Start with the React + React Native form evaluation source.
              Try installation, keyboard and native interaction, and validation.
              We welcome concrete problems, confusing steps, and broken cases
              much more than promotional reactions.
            </p>
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
                <a href='/blog/cross-platform-form-vellira'>
                  Read the form walkthrough
                </a>
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
            <p className={styles.feedbackNote}>
              Open source. No account or newsletter signup required to explore.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <BackToTop />
    </>
  );
}
