'use client';

import { ArrowRight, Book } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

import styles from './FeaturedStory.module.css';

const interviewUrl =
  'https://coderlegion.com/30253/ai-can-generate-ui-who-keeps-it-consistent-roman-bakurovs-developer-journey';

export function FeaturedStory() {
  return (
    <section
      className={styles.section}
      aria-labelledby='featured-story-title'
    >
      <div className={styles.container}>
        <article className={styles.card}>
          <div className={styles.sourcePanel}>
            <div className={styles.sourceIdentity}>
              <span className={styles.sourceMark} aria-hidden='true'>
                <Book size={20} />
              </span>

              <div>
                <span className={styles.sourceEyebrow}>Developer Story</span>
                <strong>CoderLegion</strong>
              </div>
            </div>

            <span className={styles.externalBadge}>External publication</span>
          </div>

          <div className={styles.content}>
            <div className={styles.copy}>
              <span className={styles.eyebrow}>Featured interview</span>

              <h2 id='featured-story-title'>
                AI Can Generate UI. Who Keeps It Consistent?
              </h2>

              <p>
                Roman Bakurov, founder of Vellira, talks about the path from
                product development to cross-platform UI infrastructure, why
                consistency gets harder as AI produces more code, and how
                explicit system rules can keep teams aligned.
              </p>
            </div>

            <div className={styles.meta}>
              <div>
                <span>Published by</span>
                <strong>CoderLegion</strong>
              </div>

              <div>
                <span>Format</span>
                <strong>Developer Story</strong>
              </div>

              <div>
                <span>Focus</span>
                <strong>Design systems · AI · UI governance</strong>
              </div>
            </div>

            <Button
              href={interviewUrl}
              target='_blank'
              appearance='outline'
              color='neutral'
              size='md'
              className={styles.action}
              iconEnd={<ArrowRight size={15} aria-hidden='true' />}
            >
              Read the interview
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}

FeaturedStory.displayName = 'FeaturedStory';
