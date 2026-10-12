import type { ReactNode } from 'react';

import { ComponentNavigationShell } from '../ComponentNavigationShell';

import styles from './ComponentExplorer.module.css';

interface ComponentExplorerProps {
  activeSlug: string;
  children: ReactNode;
  footer?: ReactNode;
  indexMode?: boolean;
}

export function ComponentExplorer({
  activeSlug,
  children,
  footer,
  indexMode = false,
}: ComponentExplorerProps) {
  return (
    <div className={styles.container} data-component-explorer>
      <div className={styles.layout}>
        <div className={styles.sidebarColumn} data-component-explorer-sidebar>
          <ComponentNavigationShell activeSlug={activeSlug} desktopOnly />
        </div>

        <div className={styles.mainColumn} data-component-explorer-main>
          <div className={[styles.content, indexMode ? styles.indexContent : null].filter(Boolean).join(' ')}>{children}</div>

          {footer}
        </div>
      </div>
    </div>
  );
}
