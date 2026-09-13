'use client';

import { Switch } from '@vellira-ui/react';

import styles from '../../shared/ComponentsCatalog/ComponentsCatalog.module.css';

export function SwitchCatalogPreview() {
  return (
    <div className={styles.previewColumn}>
      <Switch defaultChecked accessibilityLabel='Email notifications' />
      <Switch accessibilityLabel='Product updates' />
    </div>
  );
}
