import Image from 'next/image';

import {
  Accessibility,
  Api,
  ArrowRight,
  Docs,
  Platforms,
  Quality,
  Tokens,
} from '@vellira-ui/icons';

import aiVisual from '../../../content/blog/ai-ui-consistency/visuals/ai.png';
import coherentSystemVisual from '../../../content/blog/ai-ui-consistency/visuals/coherent-system.png';
import componentsVisual from '../../../content/blog/ai-ui-consistency/visuals/components.png';
import coordinationVisual from '../../../content/blog/ai-ui-consistency/visuals/coordination.png';
import styles from './AiUiConsistencyDiagram.module.css';

const concerns = [
  { label: 'APIs', Icon: Api },
  { label: 'Accessibility', Icon: Accessibility },
  { label: 'Tokens', Icon: Tokens },
  { label: 'Docs', Icon: Docs },
  { label: 'Platforms', Icon: Platforms },
  { label: 'Quality', Icon: Quality },
] as const;

function FlowArrow() {
  return (
    <div className={styles.arrow} aria-hidden='true'>
      <ArrowRight size={22} />
    </div>
  );
}

function ConcernMergeArrow() {
  return (
    <div className={styles.concernMerge} aria-hidden='true'>
      <span className={styles.concernMergeGraphic} />
      <ArrowRight size={18} className={styles.concernMergeMobileArrow} />
    </div>
  );
}

export function AiUiConsistencyDiagram() {
  return (
    <figure className={styles.figure}>
      <div className={styles.visual} aria-hidden='true'>
        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Image
              src={aiVisual}
              alt=''
              className={styles.stageVisual}
              sizes='54px'
            />
          </div>
          <span className={styles.label}>
            <span>AI generates</span>
            <span>more UI</span>
          </span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Image
              src={componentsVisual}
              alt=''
              className={styles.stageVisual}
              sizes='54px'
            />
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
            <Image
              src={coordinationVisual}
              alt=''
              className={styles.stageVisual}
              sizes='54px'
            />
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
              <span className={styles.concernIcon}>
                <Icon size={20} />
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <ConcernMergeArrow />

        <div className={styles.hub}>
          <Image
            src='/brand/icons/logo-icon-gradient.svg'
            alt=''
            width={50}
            height={50}
            className={styles.logoMark}
          />
          <span className={styles.wordmark}>VELLIRA</span>
        </div>

        <FlowArrow />

        <div className={styles.node}>
          <div className={styles.iconFrame}>
            <Image
              src={coherentSystemVisual}
              alt=''
              className={styles.stageVisual}
              sizes='54px'
            />
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
