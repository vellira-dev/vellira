import Link from 'next/link';

import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import styles from './CompactFooter.module.css';

export function CompactFooter() {
  return (
    <footer className={styles.root}>
      <span>© 2026 Vellira</span>

      <nav className={styles.navigation} aria-label='Footer'>
        <Link href='https://docs.vellira.dev'>Documentation</Link>

        <Link href='https://storybook.vellira.dev'>Storybook</Link>

        <Link href='https://github.com/vellira-dev/vellira'>GitHub</Link>

        <DesignSystemLink href='/privacy'>Privacy</DesignSystemLink>
      </nav>
    </footer>
  );
}
