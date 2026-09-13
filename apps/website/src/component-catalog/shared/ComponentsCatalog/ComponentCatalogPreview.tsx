'use client';

import type { ComponentType } from 'react';

import {
  Button,
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Select,
  Tabs,
} from '@vellira-ui/react';

import { ChevronDown, Edit, Settings, Trash, Info } from '@vellira-ui/icons';

import { generatedCatalogPreviews } from '../../registry/generatedCatalogPreviews';

import styles from './ComponentsCatalog.module.css';

interface ComponentCatalogPreviewProps {
  slug: string;
}

export function ComponentCatalogPreview({
  slug,
}: ComponentCatalogPreviewProps) {
  const GeneratedPreview = (
    generatedCatalogPreviews as Record<string, ComponentType>
  )[slug];

  if (GeneratedPreview) {
    return <GeneratedPreview />;
  }

  switch (slug) {
    case 'button':
      return <ButtonPreview />;

    case 'input':
      return <InputPreview />;

    case 'checkbox':
      return <CheckboxPreview />;

    case 'radio':
      return <RadioPreview />;

    case 'radio-group':
      return <RadioGroupPreview />;

    case 'select':
      return <SelectPreview />;

    case 'form-field':
      return <FormFieldPreview />;

    case 'tabs':
      return <TabsPreview />;

    case 'dropdown':
      return <DropdownPreview />;

    case 'modal':
      return <ModalPreview />;

    case 'popover':
      return <PopoverPreview />;

    case 'tooltip':
      return <TooltipPreview />;

    default:
      throw new Error(`Missing catalog signature preview for "${slug}".`);
  }
}

function ButtonPreview() {
  return (
    <div className={styles.previewStack}>
      <Button size='sm'>Primary</Button>

      <Button size='sm' appearance='outline'>
        Outline
      </Button>

      <Button size='sm' appearance='ghost'>
        Ghost
      </Button>
    </div>
  );
}

function InputPreview() {
  return (
    <div className={styles.previewFormControl}>
      <span className={styles.previewLabel}>Email</span>

      <Input size='sm' placeholder='name@company.com' aria-label='Email' />
    </div>
  );
}

function CheckboxPreview() {
  return (
    <div className={styles.previewColumn}>
      <Checkbox size='sm' defaultChecked label='Email notifications' />

      <Checkbox size='sm' defaultChecked label='Product updates' />

      <Checkbox size='sm' label='Marketing emails' />
    </div>
  );
}

function RadioPreview() {
  return (
    <div className={styles.previewColumn}>
      <Radio size='sm' value='monthly' checked readOnly label='Monthly' />

      <Radio size='sm' value='yearly' readOnly label='Yearly' />

      <Radio size='sm' value='enterprise' readOnly label='Enterprise' />
    </div>
  );
}

function RadioGroupPreview() {
  return (
    <RadioGroup
      value='md'
      orientation='horizontal'
      aria-label='Size'
      className={styles.previewRadioGroup}
    >
      <Radio value='sm' size='sm' label='Small' />

      <Radio value='md' size='sm' label='Medium' />

      <Radio value='lg' size='sm' label='Large' />
    </RadioGroup>
  );
}

function SelectPreview() {
  return (
    <div className={styles.previewFormControl}>
      <span className={styles.previewLabel}>Framework</span>

      <Select defaultValue='react' size='sm'>
        <Select.Trigger />
      </Select>
    </div>
  );
}

function FormFieldPreview() {
  return (
    <div className={styles.previewFormControl}>
      <span className={styles.previewLabel}>Email</span>

      <Input size='sm' placeholder='name@company.com' aria-label='Email' />

      <span className={styles.previewHelper}>
        Used for account notifications.
      </span>
    </div>
  );
}

function TabsPreview() {
  return (
    <Tabs
      value='overview'
      variant='line'
      size='sm'
      className={styles.previewTabsReal}
    >
      <Tabs.List>
        <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
        <Tabs.Trigger value='api'>API</Tabs.Trigger>
        <Tabs.Trigger value='examples'>Examples</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>

      <Tabs.Content value='overview'>
        <div className={styles.previewTabContent}>Component overview</div>
      </Tabs.Content>

      <Tabs.Content value='api'>
        <div className={styles.previewTabContent}>API reference</div>
      </Tabs.Content>

      <Tabs.Content value='examples'>
        <div className={styles.previewTabContent}>Examples</div>
      </Tabs.Content>
    </Tabs>
  );
}

function DropdownPreview() {
  return (
    <div className={styles.dropdownPreview}>
      <Button
        size='sm'
        appearance='outline'
        color='neutral'
        iconEnd={<ChevronDown />}
      >
        Actions
      </Button>

      <div className={styles.dropdownMenu}>
        <div className={styles.dropdownItem}>
          <Edit aria-hidden='true' />
          <span>Edit</span>
          <kbd>⌘E</kbd>
        </div>

        <div className={styles.dropdownItem}>
          <Settings aria-hidden='true' />
          <span>Settings</span>
        </div>

        <div className={styles.dropdownSeparator} />

        <div className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}>
          <Trash aria-hidden='true' />
          <span>Delete</span>
        </div>
      </div>
    </div>
  );
}

function ModalPreview() {
  return (
    <div className={styles.modalPreview}>
      <div className={styles.modalBackdrop}>
        <div className={styles.modalSurface}>
          <div className={styles.modalHeader}>
            <div>
              <strong>Workspace settings</strong>
              <span>Manage your preferences.</span>
            </div>

            <Button
              appearance='bare'
              type='button'
              className={styles.modalClose}
              tabIndex={-1}
              aria-hidden='true'
            >
              ×
            </Button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.modalSkeleton} />
            <div className={styles.modalSkeletonShort} />
          </div>

          <div className={styles.modalFooter}>
            <Button size='sm' appearance='ghost' tabIndex={-1}>
              Cancel
            </Button>

            <Button size='sm' tabIndex={-1}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PopoverPreview() {
  return (
    <div className={styles.popoverPreview}>
      <Button
        size='sm'
        appearance='outline'
        color='neutral'
        iconStart={<Settings />}
      >
        Settings
      </Button>

      <div className={styles.popoverSurface}>
        <div className={styles.popoverArrow} />

        <strong>Workspace settings</strong>

        <span>Configure preferences for this workspace.</span>

        <div className={styles.popoverActions}>
          <Button size='sm' appearance='ghost'>
            Cancel
          </Button>

          <Button size='sm'>Save</Button>
        </div>
      </div>
    </div>
  );
}

function TooltipPreview() {
  return (
    <div className={styles.tooltipPreview}>
      <div className={styles.tooltipBubble}>
        Add to favorites
        <span className={styles.tooltipArrow} />
      </div>

      <div className={styles.tooltipActions}>
        <Button
          size='sm'
          appearance='ghost'
          iconOnly
          iconStart={<Info />}
          aria-label='Information'
          tabIndex={-1}
        />

        <Button size='sm' appearance='outline' color='neutral' tabIndex={-1}>
          Hover me
        </Button>
      </div>
    </div>
  );
}
