import { Container } from '@/components/layout/Container';

import styles from './BlogNewsletterSignup.module.css';

const BUTTONDOWN_SUBSCRIBE_ENDPOINT =
  'https://buttondown.com/api/emails/embed-subscribe/vellira';

export function BlogNewsletterSignup() {
  return (
    <section
      className={styles.section}
      aria-labelledby='blog-newsletter-heading'
    >
      <Container size='wide'>
        <div className={styles.card}>
          <div>
            <p className={styles.eyebrow}>Newsletter</p>
            <h2 id='blog-newsletter-heading' className={styles.heading}>
              Keep up with Vellira
            </h2>
            <p className={styles.description}>
              Engineering notes on design systems, React, React Native,
              developer tooling, accessibility, and automation.
            </p>
          </div>

          <form
            className={styles.form}
            action={BUTTONDOWN_SUBSCRIBE_ENDPOINT}
            method='post'
          >
            <div className={styles.actions}>
              <input type='hidden' name='embed' value='1' />
              <div className={styles.field}>
                <label className={styles.label} htmlFor='blog-newsletter-email'>
                  Email address
                </label>
                <input
                  className={styles.input}
                  id='blog-newsletter-email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  placeholder='you@example.com'
                  required
                />
              </div>
              <button className={styles.button} type='submit'>
                Subscribe
              </button>
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
