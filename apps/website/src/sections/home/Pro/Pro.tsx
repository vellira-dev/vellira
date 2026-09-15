'use client';

import { motion, useReducedMotion } from 'motion/react';

import {
  ArrowRight,
  Check,
  Package,
  Settings,
  Success,
  Users,
} from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

import styles from './Pro.module.css';

const freeFeatures = [
  'React components',
  'React Native components',
  'Semantic tokens',
  'Light, dark and high contrast themes',
  'Storybook and documentation',
  'MIT-licensed source',
] as const;

const proDirections = [
  {
    index: '01',
    icon: Users,
    title: 'Team workspaces',
    description:
      'Shared libraries, ownership and collaboration around one design system.',
  },
  {
    index: '02',
    icon: Success,
    title: 'Design reviews',
    description:
      'Structured approval workflows for component and token changes.',
  },
  {
    index: '03',
    icon: Package,
    title: 'Production templates',
    description:
      'Ready-to-use foundations for common product and application patterns.',
  },
  {
    index: '04',
    icon: Settings,
    title: 'Advanced tooling',
    description: 'Deeper automation, insights and workflows for larger teams.',
  },
] as const;

const revealEase = [0.16, 1, 0.3, 1] as const;

const panelVariants = {
  hidden: {
    opacity: 0,
    y: 72,
    scale: 0.975,
    filter: 'blur(12px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 1.02,
      ease: revealEase,
      staggerChildren: 0.14,
      delayChildren: 0.16,
    },
  },
};

const leftCardVariants = {
  hidden: {
    opacity: 0,
    x: -42,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.72,
      ease: revealEase,
    },
  },
};

const rightCardVariants = {
  hidden: {
    opacity: 0,
    x: 42,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.72,
      ease: revealEase,
      staggerChildren: 0.08,
      delayChildren: 0.18,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 16,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.46,
      ease: revealEase,
    },
  },
};

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.14,
    },
  },
};

export function Pro() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id='pro' className={styles.section} aria-labelledby='pro-title'>
      <div className={styles.glow} aria-hidden='true' />

      <div className={styles.container}>
        <motion.header
          className={styles.header}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.75,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className={styles.eyebrow}>Vellira Pro</span>

          <h2 id='pro-title' className={styles.title}>
            Everything starts free.
            <span>Scale with Pro later.</span>
          </h2>

          <p className={styles.description}>
            The open-source foundation will stay free. Vellira Pro will add
            collaborative workflows and advanced tooling for growing teams.
          </p>
        </motion.header>

        <motion.div
          className={styles.proPanel}
          variants={shouldReduceMotion ? undefined : panelVariants}
          initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
          whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
          transition={{
            duration: shouldReduceMotion ? 0.2 : undefined,
          }}
          viewport={{ once: true, amount: 0.16 }}
        >
          <motion.div
            className={styles.panelHeader}
            variants={shouldReduceMotion ? undefined : itemVariants}
          >
            <div>
              <span className={styles.panelEyebrow}>Open source + Pro</span>
              <h3>Built for everyone. Extended for teams.</h3>
            </div>

            <span className={styles.comingBadge}>
              <span aria-hidden='true' />
              Coming soon
            </span>
          </motion.div>

          <div className={styles.content}>
            <motion.article
              className={styles.freeCard}
              variants={shouldReduceMotion ? undefined : leftCardVariants}
            >
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.cardEyebrow}>Available today</span>
                  <h3>Open-source foundation</h3>
                </div>

                <span className={styles.freeBadge}>Always free</span>
              </div>

              <p className={styles.cardDescription}>
                Everything needed to build production interfaces across React
                and React Native.
              </p>

              <motion.ul
                className={styles.featureList}
                variants={shouldReduceMotion ? undefined : listVariants}
              >
                {freeFeatures.map((feature) => (
                  <motion.li
                    key={feature}
                    variants={shouldReduceMotion ? undefined : itemVariants}
                  >
                    <span aria-hidden='true'>
                      <Check size={14} aria-hidden='true' />
                    </span>
                    {feature}
                  </motion.li>
                ))}
              </motion.ul>

              <Button
                asChild
                appearance='outline'
                color='neutral'
                size='md'
                className={styles.secondaryAction}
                iconEnd={<ArrowRight size={14} aria-hidden='true' />}
              >
                <a
                  href='https://docs.vellira.dev/start/getting-started'
                  target='_blank'
                  rel='noreferrer'
                >
                  Start with Vellira
                </a>
              </Button>
            </motion.article>

            <motion.article
              className={styles.proCard}
              variants={shouldReduceMotion ? undefined : rightCardVariants}
            >
              <div className={styles.proCardGlow} aria-hidden='true' />
              <div className={styles.proCardTexture} aria-hidden='true' />

              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.cardEyebrow}>Coming next</span>
                  <h3>Vellira Pro</h3>
                </div>

                <span className={styles.proBadge}>For teams</span>
              </div>

              <p className={styles.cardDescription}>
                Tools for collaboration, governance and scaling a design system
                across a larger organization.
              </p>

              <div className={styles.proDirections}>
                {proDirections.map((direction) => {
                  const Icon = direction.icon;

                  return (
                    <motion.article
                      key={direction.index}
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <span className={styles.directionIndex}>
                        <Icon size={16} aria-hidden='true' />
                      </span>

                      <div>
                        <span>{direction.index}</span>
                        <strong>{direction.title}</strong>
                        <p>{direction.description}</p>
                      </div>
                    </motion.article>
                  );
                })}
              </div>

              <motion.div
                className={styles.primaryActionWrap}
                variants={shouldReduceMotion ? undefined : itemVariants}
              >
                <Button
                  asChild
                  size='md'
                  className={styles.primaryAction}
                  iconEnd={<ArrowRight size={15} aria-hidden='true' />}
                >
                  <a href='#roadmap'>Follow the roadmap</a>
                </Button>

                <p className={styles.proNote}>
                  Pro is being shaped in public. Follow the roadmap and share
                  what your team needs.
                </p>
              </motion.div>
            </motion.article>
          </div>

          <motion.footer
            className={styles.footer}
            variants={shouldReduceMotion ? undefined : itemVariants}
          >
            <span aria-hidden='true'>
              <Check size={14} aria-hidden='true' />
            </span>

            <p>
              The open-source components, tokens and themes will remain
              available without a Pro subscription.
            </p>
          </motion.footer>
        </motion.div>
      </div>
    </section>
  );
}

Pro.displayName = 'Pro';
