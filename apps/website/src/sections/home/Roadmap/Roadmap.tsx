'use client';

import { motion, useReducedMotion } from 'motion/react';

import { ArrowRight, Check, Clock, Package, Success } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

import type { HomepageProductFacts } from '@/config/homepageProductFacts';

import styles from './Roadmap.module.css';

const roadmapColumns = [
  {
    id: 'now',
    label: 'Now',
    title: 'Shipping now',
    tone: 'success',
    items: [
      {
        title: 'Component foundations',
        description: 'Core interactive components across React and Native.',
        status: 'Available',
      },
      {
        title: 'Theme system',
        description: 'Light, dark and high-contrast semantic themes.',
        status: 'Available',
      },
      {
        title: 'Documentation platform',
        description: 'Docs, Storybook and generated API references.',
        status: 'Available',
      },
    ],
  },
  {
    id: 'next',
    label: 'Next',
    title: 'In active development',
    tone: 'primary',
    items: [
      {
        title: 'Component expansion',
        description: 'Broader coverage for production application patterns.',
        status: 'In progress',
      },
      {
        title: 'Developer tooling',
        description: 'Faster setup, generation and workspace automation.',
        status: 'Planned',
      },
      {
        title: 'Native parity',
        description: 'Continue aligning APIs and behaviours across platforms.',
        status: 'In progress',
      },
    ],
  },
  {
    id: 'later',
    label: 'Later',
    title: 'Exploring next',
    tone: 'neutral',
    items: [
      {
        title: 'Vellira Pro',
        description: 'Collaboration and governance tools for growing teams.',
        status: 'Future',
      },
      {
        title: 'Production templates',
        description: 'Reusable foundations for common product experiences.',
        status: 'Future',
      },
      {
        title: 'Advanced automation',
        description: 'Deeper workflows, insights and release intelligence.',
        status: 'Exploring',
      },
    ],
  },
] as const;

const releaseChanges = [
  'Improved component APIs',
  'Expanded semantic token coverage',
  'React Native parity work',
  'Documentation and quality updates',
] as const;

const milestones = [
  {
    version: 'Earlier milestone',
    date: 'Jul 2026',
    title: 'Release pipeline improvements',
    detail: 'Trusted publishing and validation refinements.',
  },
  {
    version: 'Recent release',
    date: 'Jun 2026',
    title: 'Theme Studio',
    detail: 'Semantic themes and live token controls.',
  },
  {
    version: 'Previous milestone',
    date: 'May 2026',
    title: 'React Native expansion',
    detail: 'Shared behaviours across web and native.',
  },
  {
    version: 'Foundation release',
    date: 'Apr 2026',
    title: 'Accessibility foundation',
    detail: 'Keyboard, focus and semantic interaction patterns.',
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
      staggerChildren: 0.16,
      delayChildren: 0.14,
    },
  },
};

const headerVariants = {
  hidden: {
    opacity: 0,
    y: -18,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.62,
      ease: revealEase,
    },
  },
};

const boardVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

const columnVariants = {
  hidden: {
    opacity: 0,
    x: -32,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.58,
      ease: revealEase,
    },
  },
};

const panelItemVariants = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: revealEase,
    },
  },
};

export function Roadmap({
  productFacts,
}: {
  productFacts: HomepageProductFacts;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id='roadmap'
      className={styles.section}
      aria-labelledby='roadmap-title'
    >
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
          <span className={styles.eyebrow}>Roadmap</span>

          <h2 id='roadmap-title' className={styles.title}>
            Built in public.
            <span>Shipping continuously.</span>
          </h2>

          <p className={styles.description}>
            The open-source foundation is available today. Broader component
            coverage, tooling and team workflows remain in development or on the
            roadmap.
          </p>
        </motion.header>

        <motion.div
          className={styles.roadmapPanel}
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
            variants={shouldReduceMotion ? undefined : headerVariants}
          >
            <div>
              <span className={styles.panelEyebrow}>Public roadmap</span>
              <h3>From current foundations to the next generation</h3>
            </div>

            <Button
              asChild
              appearance='outline'
              color='neutral'
              size='sm'
              className={styles.githubLink}
              iconEnd={<ArrowRight size={14} aria-hidden='true' />}
            >
              <a
                href='https://github.com/vellira-dev/Vellira'
                target='_blank'
                rel='noreferrer'
              >
                View on GitHub
              </a>
            </Button>
          </motion.div>

          <div className={styles.mainGrid}>
            <motion.div
              className={styles.board}
              variants={shouldReduceMotion ? undefined : boardVariants}
            >
              {roadmapColumns.map((column, index) => (
                <motion.section
                  key={column.id}
                  className={styles.column}
                  data-tone={column.tone}
                  aria-labelledby={`roadmap-${column.id}`}
                  custom={index}
                  variants={shouldReduceMotion ? undefined : columnVariants}
                >
                  <div className={styles.columnHeader}>
                    <div>
                      <span>{column.label}</span>
                      <h4 id={`roadmap-${column.id}`}>{column.title}</h4>
                    </div>

                    <strong>{column.items.length}</strong>
                  </div>

                  <div className={styles.columnItems}>
                    {column.items.map((item) => (
                      <motion.article
                        key={item.title}
                        className={styles.roadmapItem}
                        variants={
                          shouldReduceMotion ? undefined : panelItemVariants
                        }
                      >
                        <div className={styles.itemTop}>
                          <strong>{item.title}</strong>
                          <span>{item.status}</span>
                        </div>

                        <p>{item.description}</p>
                      </motion.article>
                    ))}
                  </div>
                </motion.section>
              ))}
            </motion.div>

            <motion.aside
              className={styles.releasePanel}
              variants={shouldReduceMotion ? undefined : panelItemVariants}
            >
              <div className={styles.releaseHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Latest release</span>
                  <h3>Version in source</h3>
                  <span className={styles.releaseVersion}>
                    <code>{productFacts.stableRelease ?? '—'}</code>
                    <span className={styles.releaseBadge}>Repository</span>
                  </span>
                </div>
              </div>

              <p className={styles.releaseDescription}>
                This version is read from the repository manifest used to build
                the site. See GitHub releases for what was actually published.
              </p>

              <div className={styles.releaseChanges}>
                {releaseChanges.map((change) => (
                  <div key={change}>
                    <span aria-hidden='true'>
                      <Check size={13} aria-hidden='true' />
                    </span>
                    {change}
                  </div>
                ))}
              </div>

              <Button
                asChild
                appearance='outline'
                color='neutral'
                size='sm'
                className={styles.changelogLink}
                iconEnd={<ArrowRight size={14} aria-hidden='true' />}
              >
                <a
                  href='https://github.com/vellira-dev/Vellira/releases'
                  target='_blank'
                  rel='noreferrer'
                >
                  Read changelog
                </a>
              </Button>
            </motion.aside>
          </div>

          <motion.div
            className={styles.milestones}
            variants={shouldReduceMotion ? undefined : panelItemVariants}
          >
            <div className={styles.milestonesHeader}>
              <div>
                <span className={styles.panelEyebrow}>Recent milestones</span>
                <h3>Recent progress</h3>
              </div>

              <span className={styles.updatedBadge}>
                <span aria-hidden='true' />
                Actively maintained
              </span>
            </div>

            <div className={styles.milestoneList}>
              {milestones.map((milestone) => (
                <motion.article
                  key={milestone.version}
                  variants={shouldReduceMotion ? undefined : panelItemVariants}
                >
                  <div className={styles.milestoneMarker} aria-hidden='true'>
                    <span />
                  </div>

                  <code>{milestone.version}</code>
                  <span className={styles.milestoneDate}>{milestone.date}</span>

                  <div>
                    <strong>{milestone.title}</strong>
                    <p>{milestone.detail}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>

          <motion.footer
            className={styles.footer}
            variants={shouldReduceMotion ? undefined : panelItemVariants}
          >
            <span>
              <Success size={14} aria-hidden='true' />
              Public issues
            </span>
            <span>
              <Clock size={14} aria-hidden='true' />
              Visible milestones
            </span>
            <span>
              <Package size={14} aria-hidden='true' />
              Release notes
            </span>
            <span>
              <Check size={14} aria-hidden='true' />
              Community feedback
            </span>
          </motion.footer>
        </motion.div>
      </div>
    </section>
  );
}

Roadmap.displayName = 'Roadmap';
