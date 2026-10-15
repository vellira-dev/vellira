import { Container } from '@/components/layout/Container';

import { BlogDesignSystemLink } from './BlogDesignSystemLink';
import { NewsletterSignupForm } from './NewsletterSignupForm';
import styles from './BlogNewsletterSignup.module.css';

export function BlogNewsletterSignup() {
  return (
    <section
      className={styles.section}
      aria-labelledby='blog-newsletter-heading'
    >
      <Container size='wide'>
        <div className={styles.card} data-newsletter-card>
          <div>
            <p className={styles.eyebrow}>Newsletter</p>
            <h2 id='blog-newsletter-heading' className={styles.heading}>
              Keep up with Vellira
            </h2>
            <p className={styles.description} data-newsletter-description>
              Engineering notes on design systems, React, React Native,
              developer tooling, accessibility, and automation. Interested
              specifically in Pro?{' '}
              <BlogDesignSystemLink href='/#pro'>
                Get launch updates
              </BlogDesignSystemLink>
              .
            </p>
          </div>

          <NewsletterSignupForm />
        </div>
      </Container>
    </section>
  );
}
