'use client';

import Image from 'next/image';
import Link from 'next/link';

import { motion, useReducedMotion } from 'motion/react';

import { ArrowLeftRight, ArrowRight, Check } from '@vellira-ui/icons';
import { useTheme } from '@vellira-ui/react';
import { Container } from '@/components/layout/Container';

import styles from './SiteFooter.module.css';

const productLinks = [
  { label: 'Components', href: '/components' },
  { label: 'Blog', href: '/blog' },
  { label: 'Platforms', href: '/#platforms' },
  { label: 'Themes', href: '/#themes' },
  { label: 'Pro', href: '/#pro' },
  { label: 'Roadmap', href: '/#roadmap' },
] as const;

const resourceLinks = [
  {
    label: 'Documentation',
    href: 'https://docs.vellira.dev',
  },
  {
    label: 'Storybook',
    href: 'https://storybook.vellira.dev',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/vellira-dev/Vellira',
  },
] as const;

const footerSignals = [
  'Open source',
  'Built in public',
  'Accessible foundations',
] as const;

interface SiteFooterProps {
  startSurface?: 'default' | 'canvas';
}

export function SiteFooter({ startSurface = 'default' }: SiteFooterProps = {}) {
  const shouldReduceMotion = useReducedMotion();
  const { theme } = useTheme();
  const logoSrc =
    theme === 'light'
      ? '/brand/logos/vellira-dark.svg'
      : '/brand/logos/vellira-light.svg';

  const footerClassName = [
    styles.footer,
    startSurface === 'canvas' ? styles.canvasStart : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <footer className={footerClassName}>
      <div className={styles.glow} aria-hidden='true' />

      <Container size='wide'>
        <motion.div
          className={styles.container}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 36,
                  filter: 'blur(8px)',
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
          }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.8,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <p className={styles.closingLine}>
            Start with one component. Scale to an entire design system.
          </p>

          <div className={styles.brandColumn}>
            <Link
              className={styles.brand}
              href='/'
              prefetch={false}
              aria-label='Vellira home'
            >
              <Image src={logoSrc} alt='Vellira' width={96} height={25} />
            </Link>

            <p>
              Open-source React and React Native components with shared APIs,
              semantic tokens and production-focused quality checks.
            </p>

            <div className={styles.signalList} aria-label='Project signals'>
              {footerSignals.map((signal) => (
                <span key={signal}>
                  <Check size={13} aria-hidden='true' />
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <nav className={styles.linkGrid} aria-label='Footer navigation'>
            <div className={styles.linkGroup}>
              <h2>Product</h2>

              {productLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  prefetch={link.href.startsWith('/#') ? false : undefined}
                >
                  <span className={styles.linkMarker} aria-hidden='true' />
                  {link.label}
                </Link>
              ))}
            </div>

            <div className={styles.linkGroup}>
              <h2>Resources</h2>

              {resourceLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target='_blank'
                  rel='noreferrer noopener'
                >
                  <span className={styles.linkMarker} aria-hidden='true' />
                  {link.label}
                  <ArrowRight size={13} aria-hidden='true' />
                </a>
              ))}
            </div>
          </nav>

          <aside className={styles.statusCard}>
            <span className={styles.statusEyebrow}>Shared foundation</span>

            <strong className={styles.foundationTitle}>
              React
              <ArrowLeftRight size={16} aria-hidden='true' />
              React Native
            </strong>

            <div className={styles.foundationMap} aria-hidden='true'>
              <span>React</span>
              <span>Tokens</span>
              <span>Native</span>
            </div>

            <div className={styles.statusList} aria-label='Project status'>
              <span>
                <Check size={13} aria-hidden='true' />
                Open source
              </span>
              <span>
                <Check size={13} aria-hidden='true' />
                Built in public
              </span>
              <span>
                <Check size={13} aria-hidden='true' />
                Production ready
              </span>
            </div>
          </aside>
        </motion.div>

        <div className={styles.bottomBar}>
          <span>© 2026 Vellira</span>
          <span>Independent modules. One seamless system.</span>
          <span>Built in public</span>
        </div>
      </Container>
    </footer>
  );
}

SiteFooter.displayName = 'SiteFooter';
