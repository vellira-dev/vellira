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
            AI generates
            <br />
            more UI
          </span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Grid size={30} />
          </div>
          <span className={styles.label}>
            More components
            <br />
            and changes
          </span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Warning size={30} />
          </div>
          <span className={styles.label}>
            More coordination
            <br />
            pressure
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
          <Image
            src='/brand/icons/logo-icon-white.svg'
            alt=''
            width={50}
            height={50}
            className={styles.logo}
          />
          <span className={styles.wordmark}>VELLIRA</span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <System size={30} />
          </div>
          <span className={styles.label}>
            One coherent
            <br />
            UI system
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
