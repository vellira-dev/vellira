'use client';

import Link from 'next/link';

import { Button } from '@vellira-ui/react';

import type { ComponentCatalogEntry, ComponentPlatform } from '../../types';

import styles from './ComponentHeaderActions.module.css';

type ComponentHeaderActionsProps = {
  component: ComponentCatalogEntry;
  platform: ComponentPlatform;
  onPlatformChange: (platform: ComponentPlatform) => void;
};

const platformLabels: Record<ComponentPlatform, string> = {
  react: 'React',
  'react-native': 'React Native',
};

export function ComponentHeaderActions({
  component,
  platform,
  onPlatformChange,
}: ComponentHeaderActionsProps) {
  const documentationUrl = component.docs[platform];

  return (
    <div className={styles.root}>
      <div className={styles.switcher} role='group' aria-label='Platform'>
        {component.platforms.map((item) => {
          const isActive = item === platform;

          return (
            <Button
              appearance='bare'
              key={item}
              type='button'
              className={[
                styles.platformButton,
                isActive ? styles.activePlatformButton : null,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isActive}
              onClick={() => onPlatformChange(item)}
            >
              {platformLabels[item]}
            </Button>
          );
        })}
      </div>

      {documentationUrl && (
        <Link
          className={styles.documentation}
          href={documentationUrl}
          target='_blank'
          rel='noreferrer noopener'
        >
          Documentation
          <span aria-hidden='true'>↗</span>
        </Link>
      )}
    </div>
  );
}
