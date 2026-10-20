import { DesignSystemLink } from '@/components/navigation/DesignSystemLink';

import styles from './CompactFooter.module.css';

export function CompactFooter() {
  return (
    <footer className={styles.root}>
      <span>© 2026 Vellira</span>

      <nav className={styles.navigation} aria-label='Footer'>
        <DesignSystemLink href='https://docs.vellira.dev' appearance='bare'>
          Documentation
        </DesignSystemLink>

        <DesignSystemLink
          href='https://storybook.vellira.dev'
          appearance='bare'
        >
          Storybook
        </DesignSystemLink>

        <DesignSystemLink
          href='https://github.com/vellira-dev/vellira'
          appearance='bare'
        >
          GitHub
        </DesignSystemLink>

        <DesignSystemLink href='/privacy'>Privacy</DesignSystemLink>
      </nav>
    </footer>
  );
}
