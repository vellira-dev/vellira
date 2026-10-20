'use client';

import { useState } from 'react';

import { Button } from '@vellira-ui/react';

import { Dashboard } from './Dashboard';

import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';

import styles from './ProductInterfaceDemo.module.css';

// Until PR #1760 is merged, main does not contain this source tree.
// Preview URLs are real source links; switch to main in release admission.
const previewRef = 'growth/react-native-form-try-it-20261018';
const repository = 'https://github.com/vellira-dev/vellira';
const sourceUrl =
  repository +
  '/blob/' +
  previewRef +
  '/examples/workspace-starter/web/src/Dashboard.tsx';
const starterUrl =
  repository + '/tree/' + previewRef + '/examples/workspace-starter';

export function ProductInterfaceDemo() {
  const { preference, setPreference } = useWebsiteThemeContext();
  const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <section
      id='interface'
      className={styles.section}
      aria-labelledby='product-interface-demo-title'
    >
      <div className={styles.container}>
        <header className={styles.intro}>
          <span className={styles.eyebrow}>Build with Vellira Core</span>
          <h2 id='product-interface-demo-title' className={styles.headline}>
            Vellira Dashboard Starter.
            <span>Real components. Working interface.</span>
          </h2>
          <p className={styles.description}>
            A real, interactive project dashboard built with our free React
            components. Try it, inspect the source, then use the same dashboard
            in your own project. No registration or Pro plan needed.
          </p>
          <nav className={styles.ctas} aria-label='Try Vellira Dashboard'>
            <Button asChild appearance='solid' color='primary'>
              <a href='#dashboard-live'>Try Live Demo</a>
            </Button>
            <Button asChild appearance='outline' color='neutral'>
              <a href='/demo/dashboard' target='_blank' rel='noopener noreferrer'>
                Open Full Demo
              </a>
            </Button>
            <Button asChild appearance='outline' color='neutral'>
              <a href={sourceUrl} target='_blank' rel='noopener noreferrer'>
                View Source
              </a>
            </Button>
            <Button asChild appearance='ghost' color='neutral'>
              <a href={starterUrl} target='_blank' rel='noopener noreferrer'>
                Use This Starter
              </a>
            </Button>
          </nav>
          <p className={styles.freeStatement}>
            Free Core demo · MIT source · Local sample data · No Pro
            subscription
          </p>
        </header>

        <div className={styles.previewControls} role='group' aria-label='Preview viewport'>
          <Button size='sm' appearance={preview === 'desktop' ? 'solid' : 'outline'} color={preview === 'desktop' ? 'primary' : 'neutral'} onClick={() => setPreview('desktop')} aria-pressed={preview === 'desktop'}>
            Desktop
          </Button>
          <Button size='sm' appearance={preview === 'mobile' ? 'solid' : 'outline'} color={preview === 'mobile' ? 'primary' : 'neutral'} onClick={() => setPreview('mobile')} aria-pressed={preview === 'mobile'}>
            Mobile
          </Button>
          <a href={repository + '/tree/' + previewRef + '/examples/workspace-starter/native'} target='_blank' rel='noopener noreferrer'>
            React Native / Expo setup ↗
          </a>
        </div>

        <div
          id='dashboard-live'
          className={`${styles.stage} ${preview === 'mobile' ? styles.mobileStage : ''}`}
          tabIndex={-1}
          aria-label='Interactive Vellira Dashboard Demo'
        >
          <div className={styles.windowBar}>
            <div className={styles.windowDots} aria-hidden='true'>
              <span />
              <span />
              <span />
            </div>
            <span className={styles.windowTitle}>
              Vellira Dashboard Starter
            </span>
            <span className={styles.liveIndicator}>Interactive Core demo</span>
          </div>
          <Dashboard
            variant='embedded'
            theme={preference}
            onThemeChange={setPreference}
          />
        </div>

        <div className={styles.boundary}>
          <p>
            <strong>Core remains free.</strong> This example uses published
            Vellira controls and stores only local demonstration data. Future
            Pro tiers focus on managed workflows, advanced automation, and
            separately licensed production application kits.
          </p>
          <a href='#pro'>Explore the Pro roadmap →</a>
        </div>
      </div>
    </section>
  );
}

ProductInterfaceDemo.displayName = 'ProductInterfaceDemo';
