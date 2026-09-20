import { Button, Input } from '@vellira-ui/react';

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
              <Input
                className={styles.input}
                id='blog-newsletter-email'
                label='Email address'
                name='email'
                type='email'
                autoComplete='email'
                placeholder='you@example.com'
                required
              />
              <Button
                className={styles.button}
                type='submit'
                color='primary'
                size='md'
                shape='rounded'
              >
                Subscribe
              </Button>
            </div>
          </form>
        </div>
      </Container>
    </section>
  );
}
