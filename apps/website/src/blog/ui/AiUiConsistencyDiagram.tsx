import Image from 'next/image';

import {
  ArrowRight,
  Docs,
  Eye,
  Grid,
  Monitor,
  Settings,
  Success,
  System,
  Tag,
  Warning,
} from '@vellira-ui/icons';

import styles from './AiUiConsistencyDiagram.module.css';

const concerns = [
  { label: 'APIs', Icon: Settings },
  { label: 'Accessibility', Icon: Eye },
  { label: 'Tokens', Icon: Tag },
  { label: 'Docs', Icon: Docs },
  { label: 'Platforms', Icon: Monitor },
  { label: 'Quality', Icon: Success },
] as const;

function FlowArrow() {
  return (
    <div className={styles.arrow} aria-hidden='true'>
      <ArrowRight size={22} />
    </div>
  );
}

export function AiUiConsistencyDiagram() {
  return (
    <figure className={styles.figure}>
      <div className={styles.visual} aria-hidden='true'>
        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <span className={styles.aiChip}>AI</span>
          </div>
          <span className={styles.label}>
            <span>AI generates</span>
            <span>more UI</span>
          </span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Grid size={30} />
          </div>
          <span className={styles.label}>
            <span>More</span>
            <span>components</span>
            <span>and changes</span>
          </span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Warning size={30} />
          </div>
          <span className={styles.label}>
            <span>More</span>
            <span>coordination</span>
            <span>pressure</span>
          </span>
        </div>

        <FlowArrow />

        <div className={styles.concerns}>
          {concerns.map(({ label, Icon }) => (
            <div key={label} className={styles.concern}>
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </div>

        <FlowArrow />

        <div className={styles.hub}>
          <span className={styles.logoMark}>
            <Image
              src='/brand/icons/logo-icon-dark.svg'
              alt=''
              width={50}
              height={50}
              className={`${styles.logo} ${styles.logoDark}`}
            />
            <Image
              src='/brand/icons/logo-icon-light.svg'
              alt=''
              width={50}
              height={50}
              className={`${styles.logo} ${styles.logoLight}`}
            />
          </span>
          <span className={styles.wordmark}>VELLIRA</span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <System size={30} />
          </div>
          <span className={styles.label}>
            <span>One coherent</span>
            <span>UI system</span>
          </span>
        </div>
      </div>

      <figcaption className={styles.srOnly}>
        AI-generated UI creates more components and coordination pressure
        across APIs, accessibility, tokens, documentation, platforms, and
        quality. Vellira helps bring those concerns back into one coherent UI
        system.
      </figcaption>
    </figure>
  );
}
