import Link from 'next/link';

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
          <Link href='/blog' className={styles.link}>
            Back to Vellira
          </Link>
        </section>
      </Container>
    </main>
  );
}
