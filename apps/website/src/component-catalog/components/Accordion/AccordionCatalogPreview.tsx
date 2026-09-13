'use client';

import { Accordion } from '@vellira-ui/react';

import styles from '../../shared/ComponentsCatalog/ComponentsCatalog.module.css';

export function AccordionCatalogPreview() {
  return (
    <div className={styles.previewAccordion}>
      <Accordion defaultValue='profile'>
        <Accordion.Item value='profile'>
          <Accordion.Trigger>Profile settings</Accordion.Trigger>
          <Accordion.Content>
            Update your public profile and account details.
          </Accordion.Content>
        </Accordion.Item>

        <Accordion.Item value='notifications'>
          <Accordion.Trigger>Notifications</Accordion.Trigger>
          <Accordion.Content>
            Choose when you want to receive updates.
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>
    </div>
  );
}
