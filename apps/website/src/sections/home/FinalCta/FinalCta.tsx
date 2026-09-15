'use client';

import { useState } from 'react';

import { ArrowRight, Check, Copy } from '@vellira-ui/icons';
import { motion, useReducedMotion } from 'motion/react';

import { Button } from '@vellira-ui/react';

import styles from './FinalCta.module.css';

const secondaryLinks = [
  {
    label: 'Read the docs',
    href: 'https://docs.vellira.dev',
  },
  {
    label: 'Explore Storybook',
    href: 'https://storybook.vellira.dev',
  },
  {
    label: 'View on GitHub',
    href: 'https://github.com/vellira-dev/vellira',
  },
] as const;

export function FinalCta() {
  const shouldReduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const installCommand = 'pnpm add @vellira-ui/react';

  const copyInstallCommand = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section
      id='get-started'
      className={styles.section}
      aria-labelledby='final-cta-title'
    >
      <div className={styles.glow} aria-hidden='true' />
      <div className={styles.grid} aria-hidden='true' />

      <div className={styles.container}>
        <motion.div
          className={styles.content}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 48,
                  scale: 0.98,
                  filter: 'blur(10px)',
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
          }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.95,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <span className={styles.eyebrow}>Start building</span>

          <h2 id='final-cta-title' className={styles.title}>
            Ready to build
            <span>with Vellira?</span>
          </h2>

          <p className={styles.description}>
            Production-ready React and React Native components, shared APIs and
            semantic design tokens, ready for your next product.
          </p>

          <div className={styles.actions}>
            <Button asChild size='lg'>
              <a
                href='https://docs.vellira.dev/start/getting-started'
                target='_blank'
                rel='noreferrer'
              >
                Get started
              </a>
            </Button>

            <div className={styles.secondaryLinks}>
              {secondaryLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target='_blank'
                  rel='noreferrer'
                >
                  {link.label}
                  <ArrowRight size={14} aria-hidden='true' />
                </a>
              ))}
            </div>
          </div>

          <div className={styles.installCommand}>
            <span className={styles.installLabel}>
              Get started with one command
            </span>

            <div className={styles.commandCapsule}>
              <span aria-hidden='true'>$</span>
              <code>{installCommand}</code>

              <Button
                size='sm'
                appearance='ghost'
                color='neutral'
                className={styles.copyButton}
                onClick={() => void copyInstallCommand()}
                aria-label='Copy install command'
                iconStart={
                  copied ? (
                    <Check size={14} aria-hidden='true' />
                  ) : (
                    <Copy size={14} aria-hidden='true' />
                  )
                }
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <span className={styles.installMeta}>
              React · React Native · TypeScript
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

FinalCta.displayName = 'FinalCta';
