'use client';

import { useEffect, useRef, useState } from 'react';

import { motion, useInView, useReducedMotion } from 'motion/react';
import Image from 'next/image';

import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Eye,
  Package,
} from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

import type { HomepageProductFacts } from '@/config/homepageProductFacts';
import styles from './SocialProof.module.css';

const proofMetrics = [
  {
    key: 'publishedPackages',
    label: 'Published packages',
    detail: 'React, Native, tokens, icons, types and build outputs.',
  },
  {
    key: 'builtInThemes',
    label: 'Built-in themes',
    detail: 'Light, dark and high contrast.',
  },
  {
    key: 'productionPlatforms',
    label: 'Production platforms',
    detail: 'React and React Native.',
  },
] as const;

const qualitySignals = [
  {
    label: 'TypeScript',
    value: 'Typed public APIs',
  },
  {
    label: 'Accessibility',
    value: 'Keyboard and screen-reader behaviour',
  },
  {
    label: 'Quality pipeline',
    value: 'Builds, tests, typecheck and smoke validation',
  },
  {
    label: 'Release security',
    value: 'npm trusted publishing',
  },
] as const;

const workflowChecks = [
  'Quality checks',
  'Build packages and apps',
  'Typecheck and API validation',
  'Tests and coverage',
  'Package smoke validation',
] as const;

const footerItems = [
  {
    title: 'Open source',
    description: 'Inspect every implementation',
  },
  {
    title: 'Automated validation',
    description: 'Every release follows the same contract',
  },
  {
    title: 'Trusted publishing',
    description: 'Secure delivery to npm',
  },
] as const;

const workflowStartDelay = 760;
const workflowStepDelay = 520;
const qualityRevealDelay = 1500;

export function SocialProof({
  productFacts,
}: {
  productFacts: HomepageProductFacts;
}) {
  const dashboardRef = useRef<HTMLDivElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const isDashboardInView = useInView(dashboardRef, {
    once: true,
    amount: 0.22,
  });
  const [activeCheck, setActiveCheck] = useState(-1);
  const [qualityReady, setQualityReady] = useState(false);
  const [workflowComplete, setWorkflowComplete] = useState(false);

  useEffect(() => {
    if (!isDashboardInView) {
      return;
    }

    if (shouldReduceMotion) {
      const timer = window.setTimeout(() => {
        setActiveCheck(workflowChecks.length - 1);
        setQualityReady(true);
        setWorkflowComplete(true);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }

    const timers = workflowChecks.map((_, index) =>
      window.setTimeout(
        () => {
          setActiveCheck(index);
        },
        workflowStartDelay + index * workflowStepDelay
      )
    );

    const completionTimer = window.setTimeout(
      () => {
        setWorkflowComplete(true);
      },
      workflowStartDelay + workflowChecks.length * workflowStepDelay + 420
    );

    const qualityTimer = window.setTimeout(() => {
      setQualityReady(true);
    }, qualityRevealDelay);

    return () => {
      timers.forEach(window.clearTimeout);
      window.clearTimeout(completionTimer);
      window.clearTimeout(qualityTimer);
    };
  }, [isDashboardInView, shouldReduceMotion]);

  return (
    <section
      id='proof'
      className={styles.section}
      aria-labelledby='social-proof-title'
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
          <span className={styles.eyebrow}>Built in the open</span>

          <h2 id='social-proof-title' className={styles.title}>
            Proof you can inspect.
            <span>Quality you can trust.</span>
          </h2>

          <p className={styles.description}>
            Public source, automated validation and explicit accessibility
            standards make every part of Vellira verifiable.
          </p>
        </motion.header>

        <motion.div
          ref={dashboardRef}
          className={styles.proofGrid}
          initial={
            shouldReduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 72,
                  scale: 0.975,
                  filter: 'blur(12px)',
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
          }}
          transition={{
            duration: shouldReduceMotion ? 0 : 1.05,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.16 }}
        >
          <motion.div
            className={styles.dashboardHeader}
            initial={shouldReduceMotion ? false : { opacity: 0, y: -18 }}
            animate={
              isDashboardInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -18 }
            }
            transition={{
              delay: shouldReduceMotion ? 0 : 0.28,
              duration: shouldReduceMotion ? 0 : 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className={styles.repositoryIdentity}>
              <span className={styles.repositoryMark} aria-hidden='true'>
                <Image
                  src='/brand/icons/logo-icon-dark.svg'
                  alt=''
                  width={24}
                  height={24}
                  className={styles.repositoryLogoDark}
                />
                <Image
                  src='/brand/icons/logo-icon-light.svg'
                  alt=''
                  width={24}
                  height={24}
                  className={styles.repositoryLogoLight}
                />
              </span>

              <div>
                <span className={styles.cardEyebrow}>
                  Open-source repository
                </span>
                <h3>vellira-dev/vellira</h3>
              </div>
            </div>

            <div className={styles.dashboardActions}>
              <motion.span
                className={styles.publicBadge}
                animate={
                  isDashboardInView && !shouldReduceMotion
                    ? {
                        boxShadow: [
                          '0 0 0 0 color-mix(in srgb, var(--color-success-500) 0%, transparent)',
                          '0 0 0 7px color-mix(in srgb, var(--color-success-500) 10%, transparent)',
                          '0 0 0 0 color-mix(in srgb, var(--color-success-500) 0%, transparent)',
                        ],
                      }
                    : undefined
                }
                transition={{
                  delay: 1,
                  duration: 2.4,
                  repeat: Infinity,
                  repeatDelay: 1.6,
                }}
              >
                <span aria-hidden='true' />
                Public
              </motion.span>

              <Button
                asChild
                size='sm'
                appearance='outline'
                color='neutral'
                className={styles.sourceButton}
                iconEnd={<ArrowRight size={14} aria-hidden='true' />}
              >
                <a
                  href='https://github.com/vellira-dev/Vellira'
                  target='_blank'
                  rel='noreferrer'
                >
                  View source
                </a>
              </Button>
            </div>
          </motion.div>

          <div className={styles.dashboardBody}>
            <div className={styles.repositoryColumn}>
              <article className={styles.repositoryCard}>
                <div className={styles.repositoryToolbar}>
                  <div className={styles.branchSelector}>
                    <Copy size={13} aria-hidden='true' />
                    <code>main</code>
                  </div>

                  <div className={styles.lastRun}>
                    <span title='July 28, 2026, 10:42 UTC'>
                      <Clock size={13} aria-hidden='true' />2 minutes ago
                    </span>
                    <a
                      className={styles.commitLink}
                      href='https://github.com/vellira-dev/vellira/commit/ca3d7a6'
                      target='_blank'
                      rel='noreferrer'
                      aria-label='Open commit ca3d7a6 on GitHub'
                    >
                      <code>ca3d7a6</code>
                    </a>
                  </div>
                </div>

                <motion.div
                  className={styles.workflowSummary}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={
                    isDashboardInView
                      ? { opacity: 1, y: 0 }
                      : { opacity: 0, y: 14 }
                  }
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.42,
                    duration: shouldReduceMotion ? 0 : 0.56,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <motion.span
                    className={styles.workflowPulse}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={
                      workflowComplete && !shouldReduceMotion
                        ? {
                            scaleX: [0, 1, 1],
                            opacity: [0, 1, 0],
                          }
                        : {
                            scaleX: 0,
                            opacity: 0,
                          }
                    }
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    aria-hidden='true'
                  />

                  <div className={styles.workflowStatus}>
                    <div>
                      <span className={styles.workflowKicker}>
                        Latest workflow run
                      </span>
                      <motion.strong
                        animate={
                          workflowComplete
                            ? { opacity: 1, y: 0 }
                            : { opacity: 0.72, y: 0 }
                        }
                        transition={{
                          duration: 0.24,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        {workflowComplete
                          ? 'All required checks passing'
                          : 'Validating required checks'}
                      </motion.strong>
                      <span>
                        Quality, build, typecheck, tests and package validation
                      </span>
                    </div>
                  </div>

                  <span
                    className={[
                      styles.workflowBadge,
                      workflowComplete
                        ? styles.workflowBadgeSuccess
                        : styles.workflowBadgeRunning,
                    ].join(' ')}
                  >
                    <span aria-hidden='true' />
                    {workflowComplete ? 'Success' : 'Running'}
                  </span>
                </motion.div>

                <div className={styles.checksTable}>
                  {workflowChecks.map((check, index) => {
                    const hasPassed = activeCheck > index || workflowComplete;
                    const isRunning =
                      activeCheck === index && !workflowComplete;

                    return (
                      <motion.div
                        key={check}
                        className={[
                          styles.checkRow,
                          isRunning ? styles.runningCheck : '',
                          hasPassed ? styles.passedCheck : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        initial={
                          shouldReduceMotion ? false : { opacity: 0, x: -18 }
                        }
                        animate={
                          isDashboardInView
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -18 }
                        }
                        transition={{
                          delay: shouldReduceMotion ? 0 : 0.62 + index * 0.14,
                          duration: shouldReduceMotion ? 0 : 0.52,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <span className={styles.checkName}>
                          <motion.span
                            className={styles.checkIndicator}
                            animate={
                              isRunning && !shouldReduceMotion
                                ? {
                                    opacity: [0.45, 1, 0.45],
                                    scale: [0.86, 1.08, 0.86],
                                  }
                                : {
                                    opacity: 1,
                                    scale: 1,
                                  }
                            }
                            transition={
                              isRunning
                                ? {
                                    duration: 0.9,
                                    repeat: Infinity,
                                  }
                                : {
                                    duration: 0.2,
                                  }
                            }
                            aria-hidden='true'
                          >
                            {hasPassed ? (
                              <Check size={13} aria-hidden='true' />
                            ) : isRunning ? (
                              '•'
                            ) : null}
                          </motion.span>
                          {check}
                        </span>

                        <span className={styles.checkResult}>
                          {hasPassed
                            ? 'Passed'
                            : isRunning
                              ? 'Running'
                              : 'Queued'}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                <div className={styles.repositoryFooter}>
                  <span>TypeScript</span>
                  <span>MIT licensed</span>
                  <span>Security policy</span>
                  <span>Contributing guide</span>
                </div>
              </article>

              <motion.article
                className={styles.qualityCard}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                animate={
                  qualityReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }
                }
                transition={{
                  delay: 0,
                  duration: shouldReduceMotion ? 0 : 0.62,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className={styles.qualityHeader}>
                  <div>
                    <span className={styles.cardEyebrow}>Quality contract</span>
                    <h3>Validated before every release</h3>
                  </div>

                  <span className={styles.passingBadge}>
                    <Check size={13} aria-hidden='true' />
                    Passing
                  </span>
                </div>

                <div className={styles.qualityList}>
                  {qualitySignals.map((signal, index) => (
                    <motion.div
                      key={signal.label}
                      initial={
                        shouldReduceMotion ? false : { opacity: 0, y: 16 }
                      }
                      animate={
                        qualityReady
                          ? { opacity: 1, y: 0 }
                          : { opacity: 0, y: 16 }
                      }
                      transition={{
                        delay: shouldReduceMotion ? 0 : 0.18 + index * 0.1,
                        duration: shouldReduceMotion ? 0 : 0.52,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <span className={styles.qualityCheck}>
                        <Check size={13} aria-hidden='true' />
                      </span>

                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.value}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.article>
            </div>

            <aside className={styles.insightsColumn}>
              <div className={styles.metrics}>
                {proofMetrics.map((metric, index) => {
                  const value = productFacts[metric.key];

                  return (
                    <motion.article
                      key={metric.label}
                      className={styles.metricCard}
                      initial={
                        shouldReduceMotion
                          ? false
                          : { opacity: 0, x: 24, scale: 0.97 }
                      }
                      animate={
                        isDashboardInView
                          ? { opacity: 1, x: 0, scale: 1 }
                          : { opacity: 0, x: 24, scale: 0.97 }
                      }
                      transition={{
                        delay: shouldReduceMotion ? 0 : 0.12 + index * 0.16,
                        duration: shouldReduceMotion ? 0 : 0.82,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <div className={styles.metricTop}>
                        <span>{metric.label}</span>
                        <ArrowRight size={13} aria-hidden='true' />
                      </div>

                      <strong
                        aria-label={
                          value === null
                            ? `${metric.label} unavailable`
                            : undefined
                        }
                      >
                        {value ?? '—'}
                      </strong>
                      <p>{metric.detail}</p>
                    </motion.article>
                  );
                })}
              </div>

              <article className={styles.accessibilityCard}>
                <div className={styles.accessibilityIcon}>
                  <Eye size={18} aria-hidden='true' />
                </div>

                <span className={styles.cardEyebrow}>
                  Accessible by default
                </span>

                <strong>
                  Keyboard, focus and semantic behaviour built in.
                </strong>

                <p>
                  Components are designed around real interaction patterns
                  instead of accessibility being added after visual styling.
                </p>

                <div className={styles.releaseMetric}>
                  <Package size={16} aria-hidden='true' />
                  <div>
                    <span>Latest stable release</span>
                    <strong
                      aria-label={
                        productFacts.stableRelease === null
                          ? 'Latest stable release unavailable'
                          : undefined
                      }
                    >
                      {productFacts.stableRelease ?? '—'}
                    </strong>
                  </div>
                </div>

                <Button
                  asChild
                  size='sm'
                  appearance='ghost'
                  className={styles.qualityButton}
                  iconEnd={<ArrowRight size={14} aria-hidden='true' />}
                >
                  <a
                    href='https://docs.vellira.dev/start/production'
                    target='_blank'
                    rel='noreferrer'
                  >
                    Read quality standards
                  </a>
                </Button>
              </article>
            </aside>
          </div>

          <motion.footer
            className={styles.dashboardFooter}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={
              isDashboardInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }
            }
            transition={{
              delay: shouldReduceMotion ? 0 : 2.35,
              duration: shouldReduceMotion ? 0 : 1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {footerItems.map((item) => (
              <span key={item.title}>
                <Check size={14} aria-hidden='true' />
                <span>
                  <strong>{item.title}</strong>
                  {item.description}
                </span>
              </span>
            ))}
          </motion.footer>
        </motion.div>
      </div>
    </section>
  );
}

SocialProof.displayName = 'SocialProof';
