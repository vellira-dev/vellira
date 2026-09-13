'use client';

import { useState } from 'react';

import { Check, Copy } from '@vellira-ui/icons';
import { Button, Checkbox } from '@vellira-ui/react';
import { motion, useReducedMotion } from 'motion/react';

import styles from './QuickStart.module.css';

type Appearance = 'solid' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const steps = [
  {
    index: '01',
    label: 'Install',
    file: 'Terminal',
    code: 'pnpm add @vellira-ui/react',
    language: 'shell',
  },
  {
    index: '02',
    label: 'Import',
    file: 'App.tsx',
    code: 'import { Button } from "@vellira-ui/react";',
    language: 'tsx',
  },
  {
    index: '03',
    label: 'Render',
    file: 'App.tsx',
    code: '<Button>Get started</Button>',
    language: 'tsx',
  },
] as const;

const appearances: Array<{ value: Appearance; label: string }> = [
  { value: 'solid', label: 'Solid' },
  { value: 'outline', label: 'Outline' },
  { value: 'ghost', label: 'Ghost' },
];

const sizes: Array<{ value: ButtonSize; label: string }> = [
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
];

const revealEase = [0.16, 1, 0.3, 1] as const;

const stepVariants = {
  hidden: {
    opacity: 0,
    x: -28,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
  },
};

const previewCardVariants = {
  hidden: {
    opacity: 0,
    y: 32,
    filter: 'blur(10px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  },
};

export function QuickStart() {
  const shouldReduceMotion = useReducedMotion();
  const [appearance, setAppearance] = useState<Appearance>('solid');
  const [size, setSize] = useState<ButtonSize>('md');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const copyCode = async (index: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedStep(index);
    window.setTimeout(() => setCopiedStep(null), 1400);
  };

  return (
    <section
      id='quick-start'
      className={styles.section}
      aria-labelledby='quick-start-title'
    >
      <div className={styles.glow} aria-hidden='true' />

      <div className={styles.container}>
        <motion.header
          className={styles.header}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.75,
            ease: revealEase,
          }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className={styles.eyebrow}>Developer experience</span>

          <h2 id='quick-start-title' className={styles.title}>
            Install once.
            <span>Ship your first component.</span>
          </h2>

          <p className={styles.description}>
            Add the package, import a component and render your first Vellira
            interface without leaving the flow.
          </p>
        </motion.header>

        <motion.div
          className={styles.quickStart}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 72, filter: 'blur(10px)' }
          }
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.08,
            duration: shouldReduceMotion ? 0.2 : 0.95,
            ease: revealEase,
          }}
          viewport={{ once: true, amount: 0.16 }}
        >
          <div className={styles.stepsPanel}>
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Quick start</span>
                <h3>Three steps to your first component</h3>
              </div>

              <span className={styles.timeBadge}>Under 2 minutes</span>
            </div>

            <div className={styles.steps}>
              {steps.map((step) => {
                const isCopied = copiedStep === step.index;

                return (
                  <motion.article
                    key={step.index}
                    className={styles.step}
                    variants={shouldReduceMotion ? undefined : stepVariants}
                    initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
                    whileInView={
                      shouldReduceMotion ? { opacity: 1 } : 'visible'
                    }
                    transition={{
                      delay: shouldReduceMotion
                        ? 0
                        : 0.2 + Number(step.index) * 0.16,
                      duration: shouldReduceMotion ? 0.12 : 0.58,
                      ease: revealEase,
                    }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                    <div className={styles.stepMeta}>
                      <span>{step.index}</span>
                      <strong>{step.label}</strong>
                    </div>

                    <div className={styles.editor}>
                      <div className={styles.editorHeader}>
                        <span>{step.file}</span>

                        <Button
                          appearance='bare'
                          type='button'
                          className={styles.copyButton}
                          onClick={() => void copyCode(step.index, step.code)}
                          aria-label={`Copy ${step.label} command`}
                        >
                          {isCopied ? (
                            <Check size={14} aria-hidden='true' />
                          ) : (
                            <Copy size={14} aria-hidden='true' />
                          )}
                          {isCopied ? 'Copied' : 'Copy'}
                        </Button>
                      </div>

                      <pre>
                        <code data-language={step.language}>
                          {step.language === 'shell' ? '$ ' : ''}
                          {step.code}
                        </code>
                      </pre>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </div>

          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <div>
                <span className={styles.panelEyebrow}>Live result</span>
                <h3>Your first Vellira component</h3>
              </div>

              <span className={styles.liveBadge}>
                <span aria-hidden='true' />
                Ready
              </span>
            </div>

            <div className={styles.previewStage}>
              <motion.div
                className={styles.previewCard}
                variants={shouldReduceMotion ? undefined : previewCardVariants}
                initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
                whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
                transition={{
                  delay: shouldReduceMotion ? 0 : 0.82,
                  duration: shouldReduceMotion ? 0.12 : 0.68,
                  ease: revealEase,
                }}
                viewport={{ once: true, amount: 0.35 }}
              >
                <span className={styles.previewEyebrow}>First component</span>

                <h4>Build with Vellira</h4>

                <p>
                  Accessible defaults, semantic tokens and production-ready
                  behavior are already included.
                </p>

                <div className={styles.controls} aria-label='Button preview'>
                  <div className={styles.controlsHeader}>
                    <span>Component controls</span>
                    <code>
                      {appearance} · {size}
                      {isLoading ? ' · loading' : ''}
                    </code>
                  </div>

                  <div className={styles.controlGrid}>
                    <div className={styles.controlField}>
                      <span>Variant</span>
                      <div
                        className={styles.segmentedControl}
                        role='group'
                        aria-label='Button appearance'
                      >
                        {appearances.map((option) => (
                          <Button
                            key={option.value}
                            appearance='bare'
                            type='button'
                            className={styles.segmentedButton}
                            aria-pressed={appearance === option.value}
                            onClick={() => setAppearance(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.controlField}>
                      <span>Size</span>
                      <div
                        className={styles.segmentedControl}
                        role='group'
                        aria-label='Button size'
                      >
                        {sizes.map((option) => (
                          <Button
                            key={option.value}
                            appearance='bare'
                            type='button'
                            className={styles.segmentedButton}
                            aria-pressed={size === option.value}
                            onClick={() => setSize(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={styles.loadingToggle}>
                    <Checkbox
                      label='Loading state'
                      size='sm'
                      checked={isLoading}
                      onCheckedChange={setIsLoading}
                    />
                  </div>
                </div>

                <Button
                  href='https://docs.vellira.dev/getting-started'
                  target='_blank'
                  rel='noreferrer'
                  appearance={appearance}
                  size={size}
                  className={styles.previewButton}
                  loading={isLoading}
                  loadingText='Preparing docs'
                >
                  Get started
                </Button>

                <span className={styles.readyBadge}>
                  <Check size={13} aria-hidden='true' />
                  Accessible by default
                </span>
              </motion.div>
            </div>
          </div>

          <footer className={styles.footer}>
            <a
              href='https://docs.vellira.dev/getting-started'
              target='_blank'
              rel='noreferrer'
            >
              Getting started
            </a>

            <a
              href='https://storybook.vellira.dev'
              target='_blank'
              rel='noreferrer'
            >
              Explore Storybook
            </a>

            <a
              href='https://github.com/vellira-dev/Vellira'
              target='_blank'
              rel='noreferrer'
            >
              View source
            </a>
          </footer>
        </motion.div>
      </div>
    </section>
  );
}

QuickStart.displayName = 'QuickStart';
