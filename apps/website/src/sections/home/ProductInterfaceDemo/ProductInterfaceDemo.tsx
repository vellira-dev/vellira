'use client';

import { useState } from 'react';

import dynamic from 'next/dynamic';

import { Button, Tabs } from '@vellira-ui/react';

import { Dashboard } from './Dashboard';

const NativeStarterPreview = dynamic(
  () =>
    import('./NativeStarterPreview').then((module) => module.NativeStarterPreview),
  { ssr: false }
);

import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import { useWebsiteThemeContext } from '@/providers/WebsiteThemeContext';

import styles from './ProductInterfaceDemo.module.css';

// Public release source is maintained on the canonical main branch.
const sourceRef = 'main';
const repository = 'https://github.com/vellira-dev/vellira';
const sourceUrl =
  repository +
  '/blob/' +
  sourceRef +
  '/examples/workspace-starter/web/src/Dashboard.tsx';
const starterUrl =
  repository + '/tree/' + sourceRef + '/examples/workspace-starter';
const nativeSourceUrl =
  repository +
  '/blob/' +
  sourceRef +
  '/examples/workspace-starter/native/App.tsx';
const nativeStarterUrl = starterUrl + '/native';

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
            Try the interactive React Web dashboard, then explore the
            React Native Starter's mobile interface. Both are free Core
            examples with public source and no account required.
          </p>
          <nav className={styles.ctas} aria-label='Try Vellira Dashboard'>
            <Button asChild appearance='solid' color='primary'>
              <a href='#dashboard-live'>Try Live Demo</a>
            </Button>
            <Button asChild appearance='outline' color='neutral'>
              <a
                href='/demo/dashboard'
                target='_blank'
                rel='noopener noreferrer'
              >
                Open Full Demo
              </a>
            </Button>
            <Button asChild appearance='outline' color='neutral'>
              <a
                href={preview === 'mobile' ? nativeSourceUrl : sourceUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
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

        <div className={styles.previewToolbar}>
          <Tabs
            value={preview}
            onValueChange={(next) => {
              if (next === 'desktop' || next === 'mobile') setPreview(next);
            }}
          >
            <Tabs.List aria-label='Dashboard preview platform'>
              <Tabs.Trigger value='desktop'>Desktop</Tabs.Trigger>
              <Tabs.Trigger value='mobile'>Mobile</Tabs.Trigger>
            </Tabs.List>
          </Tabs>
          <span className={styles.previewHint}>
            {preview === 'desktop'
              ? 'Interactive React Web'
              : 'React Native Starter · rendered in the browser'}
          </span>
        </div>
        <div
          id='dashboard-live'
          className={`${styles.stage} ${preview === 'mobile' ? styles.mobileStage : ''}`}
          tabIndex={-1}
          aria-label='Interactive Vellira Dashboard Demo'
        >
          {preview === 'desktop' ? (
            <>
              <div className={styles.windowBar}>
                <div className={styles.windowDots} aria-hidden='true'>
                  <span />
                  <span />
                  <span />
                </div>
                <span className={styles.windowTitle}>
                  Vellira Dashboard Starter
                </span>
                <span className={styles.liveIndicator}>
                  Interactive Core demo
                </span>
              </div>
              <Dashboard
                variant='embedded'
                theme={preference}
                onThemeChange={setPreference}
              />
            </>
          ) : (
            <div className={styles.nativeStageContent}>
              <NativeStarterPreview />
            </div>
          )}
        </div>
        <div
          className={`${styles.nativeLink} ${preview === 'mobile' ? styles.nativeCaption : ''}`}
        >
          {preview === 'mobile' ? (
            <>
              <span>
                <strong>React Native / Expo</strong> · Browser preview
              </span>
              <DesignSystemLink
                href={nativeStarterUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                Setup instructions ↗
              </DesignSystemLink>
            </>
          ) : (
            <>
              Want to see the native UI instead of a narrowed Web layout?
              Choose <strong>Mobile</strong> above or{' '}
              <DesignSystemLink
                href={nativeStarterUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                Setup instructions ↗
              </DesignSystemLink>
              .
            </>
          )}
        </div>

        {preview === 'desktop' ? (
          <div className={styles.boundary}>
            <p>
              <strong>Core remains free.</strong> This example uses published
              Vellira controls and stores only local demonstration data. Future
              Pro tiers focus on managed workflows, advanced automation, and
              separately licensed production application kits.
            </p>
            <DesignSystemLink href='#pro'>
              Explore the Pro roadmap →
            </DesignSystemLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

ProductInterfaceDemo.displayName = 'ProductInterfaceDemo';
