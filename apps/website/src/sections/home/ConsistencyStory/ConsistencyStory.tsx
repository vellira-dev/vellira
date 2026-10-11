import Link from 'next/link';

import styles from './ConsistencyStory.module.css';

const available = [
  'React and React Native component packages',
  'Shared tokens and accessible interaction foundations',
  'Documentation, Storybook and public source',
] as const;

const checks = [
  'Machine-readable component metadata',
  'Completeness and quality checks',
  'Tests, public APIs and documented expectations',
] as const;

export function ConsistencyStory() {
  return (
    <section
      id='why-vellira'
      className={styles.section}
      aria-labelledby='consistency-story-title'
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Why Vellira exists</span>
          <h2 id='consistency-story-title' className={styles.title}>
            AI can generate more UI.
            <span>Who keeps it consistent?</span>
          </h2>
          <p className={styles.description}>
            A component can look correct on its own and still drift from
            the design system around it. Vellira starts with usable
            cross-platform foundations and public quality checks.
            The wider ambition is to make consistency easier to maintain
            as people and AI ship more changes.
          </p>
        </header>

        <div className={styles.cards}>
          <article className={styles.card}>
            <span className={styles.status}>Available now</span>
            <h3>Build on shared foundations</h3>
            <p>
              Use real open-source components today, and check each platform's
              documented API before adopting it.
            </p>
            <ul className={styles.list}>
              {available.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href='/components' className={styles.link}>
              Explore components <span aria-hidden='true'>→</span>
            </Link>
          </article>

          <article className={styles.card}>
            <span className={styles.status}>Inspectable today</span>
            <h3>Quality beyond compilation</h3>
            <p>
              Public metadata and automated checks make component expectations
              more explicit. These are verifiable engineering controls, not
              a claim that all UI can already be generated autonomously.
            </p>
            <ul className={styles.list}>
              {checks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href='/blog/quality-gates-before-component-growth'
              className={styles.link}
            >
              Read about quality gates <span aria-hidden='true'>→</span>
            </Link>
          </article>

          <article className={styles.card}>
            <span className={styles.status}>In development</span>
            <h3>Keep future changes coherent</h3>
            <p>
              Vellira is evolving toward stronger governed workflows for
              UI changes. End-to-end autonomous production and future Pro
              tooling are not part of today's public component packages.
            </p>
            <div className={styles.note}>
              The roadmap describes a direction, not a currently shipping
              product feature.
            </div>
            <Link href='/blog/ai-ui-consistency' className={styles.link}>
              Why AI changes the problem <span aria-hidden='true'>→</span>
            </Link>
          </article>
        </div>

        <div className={styles.footer}>
          <p>
            Start with what ships. Inspect the source. Follow the roadmap.
          </p>
          <Link href='https://github.com/vellira-dev/vellira'>
            View public repository <span aria-hidden='true'>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
