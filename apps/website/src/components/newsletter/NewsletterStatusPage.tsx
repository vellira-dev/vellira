import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import { Container } from '@/components/layout/Container';

import styles from './NewsletterStatusPage.module.css';

interface NewsletterStatusPageProps {
  heading: string;
  body: string;
}

export function NewsletterStatusPage({
  heading,
  body,
}: NewsletterStatusPageProps) {
  return (
    <main className={styles.page}>
      <Container size='content'>
        <section
          className={styles.card}
          aria-labelledby='newsletter-status-heading'
        >
          <p className={styles.eyebrow}>Newsletter</p>
          <h1 id='newsletter-status-heading' className={styles.heading}>
            {heading}
          </h1>
          <p className={styles.body}>{body}</p>
          <Button asChild appearance='solid' className={styles.link}>
            <Link href='/blog'>Back to Vellira</Link>
          </Button>
        </section>
      </Container>
    </main>
  );
}
