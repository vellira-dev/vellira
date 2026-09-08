'use client';

import { useState } from 'react';

import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  Download,
  File,
  Filter,
  Save,
  Search,
  Settings,
  Share,
  Trash,
  Upload,
  Users,
} from '@vellira-ui/icons';
import {
  Button,
  Checkbox,
  Dropdown,
  FormField,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Tabs,
  Tooltip,
} from '@vellira-ui/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import styles from './ComponentShowcase.module.css';

type ComponentName =
  | 'button'
  | 'dropdown'
  | 'modal'
  | 'input'
  | 'tabs'
  | 'checkbox'
  | 'radio'
  | 'tooltip';

const components: Array<{
  value: ComponentName;
  label: string;
}> = [
  { value: 'button', label: 'Button' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'modal', label: 'Modal' },
  { value: 'input', label: 'Input' },
  { value: 'tabs', label: 'Tabs' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio' },
  { value: 'tooltip', label: 'Tooltip' },
];

const componentLinks: Record<
  ComponentName,
  {
    docs: string;
    storybook: string;
    source: string;
  }
> = {
  button: {
    docs: 'https://docs.vellira.dev/components/button',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/primitives-button--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/primitives/Button',
  },
  dropdown: {
    docs: 'https://docs.vellira.dev/components/dropdown',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/components-dropdown--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/components/Dropdown',
  },
  modal: {
    docs: 'https://docs.vellira.dev/components/modal',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/components-modal--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/components/Modal',
  },
  input: {
    docs: 'https://docs.vellira.dev/components/input',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/primitives-input--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/primitives/Input',
  },
  tabs: {
    docs: 'https://docs.vellira.dev/components/tabs',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/components-tabs--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/components/Tabs',
  },
  checkbox: {
    docs: 'https://docs.vellira.dev/components/checkbox',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/primitives-checkbox--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/primitives/Checkbox',
  },
  radio: {
    docs: 'https://docs.vellira.dev/components/radio',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/primitives-radio--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/primitives/Radio',
  },
  tooltip: {
    docs: 'https://docs.vellira.dev/components/tooltip',
    storybook:
      'https://storybook.vellira.dev/?path=/docs/components-tooltip--docs',
    source:
      'https://github.com/vellira-dev/Vellira/tree/main/packages/react/src/components/Tooltip',
  },
};

const buttonColors = [
  'primary',
  'neutral',
  'success',
  'warning',
  'danger',
] as const;

const buttonAppearances = ['solid', 'soft', 'outline', 'ghost'] as const;

const dropdownExamples = [
  { value: 'actions', label: 'Actions' },
  { value: 'access', label: 'Access' },
  { value: 'command', label: 'Command' },
] as const;

type DropdownExample = (typeof dropdownExamples)[number]['value'];

const revealEase = [0.16, 1, 0.3, 1] as const;

const panelReveal = {
  hidden: {
    opacity: 0,
    y: 18,
    filter: 'blur(6px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  },
};

const sceneVariants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 54,
    y: 12,
    scale: 0.975,
    filter: 'blur(8px)',
  }),
  center: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -38,
    y: -8,
    scale: 0.985,
    filter: 'blur(6px)',
  }),
};

const listVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: {
    opacity: 0,
    y: 16,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.34,
      ease: revealEase,
    },
  },
};

export function ComponentShowcase() {
  const shouldReduceMotion = useReducedMotion();

  const [activeComponent, setActiveComponent] =
    useState<ComponentName>('button');
  const [direction, setDirection] = useState(1);
  const [inputValue, setInputValue] = useState('Vellira workspace');
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [radioValue, setRadioValue] = useState('pro');
  const [tabValue, setTabValue] = useState('preview');
  const [dropdownExample, setDropdownExample] =
    useState<DropdownExample>('actions');
  const activeComponentIndex = components.findIndex(
    (component) => component.value === activeComponent
  );
  const activeLinks = componentLinks[activeComponent];

  const selectComponent = (nextComponent: ComponentName) => {
    const nextIndex = components.findIndex(
      (component) => component.value === nextComponent
    );

    setDirection(nextIndex > activeComponentIndex ? 1 : -1);
    setActiveComponent(nextComponent);
  };

  return (
    <section
      id='components'
      className={styles.section}
      aria-labelledby='component-showcase-title'
    >
      <div className={styles.glow} aria-hidden='true' />

      <div className={styles.container}>
        <motion.header
          className={styles.header}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className={styles.eyebrow}>Built for production</span>

          <h2 id='component-showcase-title' className={styles.title}>
            Real components.
            <span>Real interaction.</span>
          </h2>

          <p className={styles.description}>
            Every example below is rendered from the actual Vellira component
            library. Open it, type into it and interact with it.
          </p>
        </motion.header>

        <motion.div
          className={styles.showcase}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 112,
                  scale: 0.94,
                  filter: 'blur(18px)',
                }
          }
          whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.08,
            duration: shouldReduceMotion ? 0.2 : 1.18,
            ease: revealEase,
          }}
          viewport={{ once: true, amount: 0.14 }}
        >
          <motion.div
            className={styles.toolbar}
            variants={shouldReduceMotion ? undefined : panelReveal}
            initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
            whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.14,
              duration: shouldReduceMotion ? 0.12 : 0.5,
              ease: revealEase,
            }}
            viewport={{ once: true }}
          >
            <div className={styles.componentPicker}>
              {components.map((component) => (
                <Button
                  key={component.value}
                  type='button'
                  appearance='ghost'
                  color='neutral'
                  size='sm'
                  className={styles.componentButton}
                  data-active={activeComponent === component.value}
                  onClick={() => {
                    selectComponent(component.value);
                  }}
                >
                  {activeComponent === component.value && (
                    <motion.span
                      layoutId='component-showcase-active-tab'
                      className={styles.activeTabBackground}
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}

                  <span className={styles.componentButtonLabel}>
                    {component.label}
                  </span>
                </Button>
              ))}
            </div>

            <motion.div
              className={styles.toolbarMeta}
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }
              }
              whileInView={{ opacity: 1, x: 0 }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.32,
                duration: shouldReduceMotion ? 0.12 : 0.56,
                ease: revealEase,
              }}
              viewport={{ once: true }}
            >
              <div className={styles.renderBadge}>
                <span className={styles.packageStatus} aria-hidden='true' />
                <div>
                  <span>Rendered by</span>
                  <code>@vellira-ui/react</code>
                </div>
              </div>

              <nav className={styles.toolbarLinks} aria-label='Component links'>
                <a href={activeLinks.docs} target='_blank' rel='noreferrer'>
                  Docs
                </a>
                <a
                  href={activeLinks.storybook}
                  target='_blank'
                  rel='noreferrer'
                >
                  Storybook
                </a>
                <a href={activeLinks.source} target='_blank' rel='noreferrer'>
                  Source
                </a>
              </nav>
            </motion.div>
          </motion.div>

          <motion.div
            className={styles.stage}
            variants={shouldReduceMotion ? undefined : panelReveal}
            initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
            whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.28,
              duration: shouldReduceMotion ? 0.12 : 0.56,
              ease: revealEase,
            }}
            viewport={{ once: true }}
          >
            <AnimatePresence mode='wait' custom={direction} initial={false}>
              <motion.div
                key={activeComponent}
                custom={direction}
                className={styles.demo}
                variants={shouldReduceMotion ? undefined : sceneVariants}
                initial={shouldReduceMotion ? { opacity: 0 } : 'enter'}
                animate={shouldReduceMotion ? { opacity: 1 } : 'center'}
                exit={shouldReduceMotion ? { opacity: 0 } : 'exit'}
                transition={{
                  duration: shouldReduceMotion ? 0.15 : 0.52,
                  ease: revealEase,
                }}
              >
                {activeComponent === 'button' && (
                  <motion.div
                    className={styles.buttonDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <div className={styles.buttonMatrix}>
                      {buttonColors.map((color) => (
                        <motion.div
                          key={color}
                          className={styles.buttonRow}
                          variants={
                            shouldReduceMotion ? undefined : itemVariants
                          }
                        >
                          <span>{color}</span>

                          {buttonAppearances.map((appearance) => (
                            <Button
                              key={`${color}-${appearance}`}
                              appearance={appearance}
                              color={color}
                              size='sm'
                              className={
                                appearance === 'soft'
                                  ? styles.softButtonDemo
                                  : undefined
                              }
                            >
                              {appearance}
                            </Button>
                          ))}
                        </motion.div>
                      ))}
                    </div>

                    <motion.div
                      className={styles.buttonCombos}
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Button shape='pill' iconStart={<Download />}>
                        Export
                      </Button>
                      <Button
                        appearance='soft'
                        color='neutral'
                        badge='3'
                        iconStart={<Bell />}
                      >
                        Alerts
                      </Button>
                      <Button
                        appearance='outline'
                        color='success'
                        shortcut='⌘S'
                        iconStart={<Check />}
                      >
                        Saved
                      </Button>
                      <Button shape='square' aria-label='Search'>
                        <Search aria-hidden='true' />
                      </Button>
                    </motion.div>
                  </motion.div>
                )}

                {activeComponent === 'dropdown' && (
                  <motion.div
                    className={styles.dropdownDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <div
                        role='tablist'
                        className={styles.dropdownSwitcher}
                        aria-label='Dropdown examples'
                      >
                        {dropdownExamples.map((example) => (
                          <Button
                            key={example.value}
                            type='button'
                            appearance='ghost'
                            color='neutral'
                            size='sm'
                            role='tab'
                            aria-selected={dropdownExample === example.value}
                            className={styles.dropdownSwitchButton}
                            data-active={dropdownExample === example.value}
                            onClick={() => {
                              setDropdownExample(example.value);
                            }}
                          >
                            {example.label}
                          </Button>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div
                      className={styles.dropdownShell}
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <div className={styles.dropdownToolbar}>
                        <div>
                          <span className={styles.pageEyebrow}>
                            {dropdownExample === 'actions' && 'Project menu'}
                            {dropdownExample === 'access' && 'Team access'}
                            {dropdownExample === 'command' && 'Command menu'}
                          </span>
                          <strong>
                            {dropdownExample === 'actions' &&
                              'Design system website'}
                            {dropdownExample === 'access' &&
                              'Review permissions'}
                            {dropdownExample === 'command' &&
                              'Find workspace action'}
                          </strong>
                        </div>

                        <Dropdown
                          open
                          placement='bottom-end'
                          offset={8}
                          minWidth='min(360px, calc(100vw - 64px))'
                          maxWidth='min(360px, calc(100vw - 64px))'
                          closeOnSelect={false}
                          portal={false}
                        >
                          <Dropdown.Trigger
                            asChild
                            className={styles.dropdownTriggerButton}
                          >
                            <Button
                              type='button'
                              appearance='outline'
                              color='neutral'
                              size='sm'
                            >
                              <span>
                                {dropdownExample === 'actions' && 'Actions'}
                                {dropdownExample === 'access' && 'Invite'}
                                {dropdownExample === 'command' && 'Search'}
                              </span>
                              <ChevronDown
                                className={styles.dropdownTriggerIcon}
                                size={16}
                                aria-hidden='true'
                              />
                            </Button>
                          </Dropdown.Trigger>

                          <Dropdown.Content
                            className={styles.dropdownContent}
                            style={{ minHeight: 248 }}
                          >
                            {dropdownExample === 'actions' && (
                              <>
                                <Dropdown.Group>
                                  <Dropdown.Label>Workspace</Dropdown.Label>

                                  <Dropdown.Item>
                                    <Dropdown.ItemIcon>
                                      <Settings />
                                    </Dropdown.ItemIcon>
                                    Settings
                                    <Dropdown.ItemDescription>
                                      Members, billing, and theme defaults
                                    </Dropdown.ItemDescription>
                                    <Dropdown.ItemShortcut>
                                      ⌘,
                                    </Dropdown.ItemShortcut>
                                  </Dropdown.Item>

                                  <Dropdown.Item>
                                    <Dropdown.ItemIcon>
                                      <Copy />
                                    </Dropdown.ItemIcon>
                                    Copy preview link
                                    <Dropdown.ItemBadge>
                                      Public
                                    </Dropdown.ItemBadge>
                                  </Dropdown.Item>
                                </Dropdown.Group>

                                <Dropdown.Separator />

                                <Dropdown.Sub>
                                  <Dropdown.SubTrigger icon={<Upload />}>
                                    Export
                                  </Dropdown.SubTrigger>
                                  <Dropdown.SubContent>
                                    <Dropdown.Item icon={<File />}>
                                      Export as PDF
                                    </Dropdown.Item>
                                    <Dropdown.Item icon={<Download />}>
                                      Download archive
                                    </Dropdown.Item>
                                  </Dropdown.SubContent>
                                </Dropdown.Sub>

                                <Dropdown.Item color='danger'>
                                  <Dropdown.ItemIcon>
                                    <Trash />
                                  </Dropdown.ItemIcon>
                                  Delete workspace
                                </Dropdown.Item>
                              </>
                            )}

                            {dropdownExample === 'access' && (
                              <>
                                <Dropdown.Group>
                                  <Dropdown.Label>Visibility</Dropdown.Label>

                                  <Dropdown.CheckboxItem defaultChecked>
                                    Notify reviewers
                                  </Dropdown.CheckboxItem>
                                  <Dropdown.CheckboxItem defaultChecked>
                                    Include changelog
                                  </Dropdown.CheckboxItem>
                                  <Dropdown.CheckboxItem>
                                    Require approval
                                  </Dropdown.CheckboxItem>
                                </Dropdown.Group>

                                <Dropdown.Separator />

                                <Dropdown.Group>
                                  <Dropdown.Label>Role</Dropdown.Label>
                                  <Dropdown.RadioGroup defaultValue='editor'>
                                    <Dropdown.RadioItem value='viewer'>
                                      Viewer
                                    </Dropdown.RadioItem>
                                    <Dropdown.RadioItem value='editor'>
                                      Editor
                                    </Dropdown.RadioItem>
                                    <Dropdown.RadioItem value='admin'>
                                      Admin
                                    </Dropdown.RadioItem>
                                  </Dropdown.RadioGroup>
                                </Dropdown.Group>
                              </>
                            )}

                            {dropdownExample === 'command' && (
                              <>
                                <Dropdown.Search placeholder='Search actions' />

                                <Dropdown.Item>
                                  <Dropdown.ItemIcon>
                                    <Filter />
                                  </Dropdown.ItemIcon>
                                  Filter components
                                  <Dropdown.ItemShortcut>
                                    F
                                  </Dropdown.ItemShortcut>
                                </Dropdown.Item>

                                <Dropdown.Item>
                                  <Dropdown.ItemIcon>
                                    <Users />
                                  </Dropdown.ItemIcon>
                                  Invite teammate
                                  <Dropdown.ItemBadge>New</Dropdown.ItemBadge>
                                </Dropdown.Item>

                                <Dropdown.Item>
                                  <Dropdown.ItemIcon>
                                    <Save />
                                  </Dropdown.ItemIcon>
                                  Save as preset
                                  <Dropdown.ItemDescription>
                                    Reuse this view in docs and Storybook
                                  </Dropdown.ItemDescription>
                                </Dropdown.Item>

                                <Dropdown.Separator />

                                <Dropdown.Item icon={<Share />}>
                                  Share current view
                                </Dropdown.Item>
                              </>
                            )}
                          </Dropdown.Content>
                        </Dropdown>
                      </div>

                      <div className={styles.dropdownPreview}>
                        <div className={styles.dropdownMetric}>
                          <span>Release</span>
                          <strong>v0.8.4</strong>
                        </div>
                        <div className={styles.dropdownMetric}>
                          <span>Reviewers</span>
                          <strong>12</strong>
                        </div>
                        <div className={styles.dropdownMetric}>
                          <span>Status</span>
                          <strong>Ready</strong>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {activeComponent === 'modal' && (
                  <motion.div
                    className={styles.modalDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <motion.div
                      className={styles.modalShell}
                      variants={shouldReduceMotion ? undefined : listVariants}
                    >
                      <motion.div
                        className={styles.modalPreviewCard}
                        variants={shouldReduceMotion ? undefined : itemVariants}
                      >
                        <div>
                          <span className={styles.pageEyebrow}>Form</span>
                          <strong>Settings dialog</strong>
                          <p>
                            Open a real modal rendered from the package, with a
                            form body and accessible close actions.
                          </p>
                        </div>

                        <Modal
                          animation='scale'
                          duration={{ open: 180, close: 150 }}
                        >
                          <Modal.Trigger asChild>
                            <Button iconStart={<Settings />}>
                              Open settings
                            </Button>
                          </Modal.Trigger>
                          <Modal.Overlay />
                          <Modal.Content size='md' scrollBehavior='inside'>
                            <Modal.Header>
                              <div>
                                <Modal.Title>Workspace settings</Modal.Title>
                                <Modal.Description>
                                  Edit team-facing workspace details.
                                </Modal.Description>
                              </div>
                              <Modal.Close />
                            </Modal.Header>
                            <Modal.Body>
                              <div className={styles.modalForm}>
                                <FormField label='Workspace name'>
                                  <Input defaultValue='Vellira workspace' />
                                </FormField>
                                <Checkbox
                                  label='Notify members'
                                  description='Send a summary after changes are saved.'
                                  defaultChecked
                                />
                              </div>
                            </Modal.Body>
                            <Modal.Footer>
                              <Modal.Close asChild>
                                <Button appearance='ghost' color='neutral'>
                                  Cancel
                                </Button>
                              </Modal.Close>
                              <Modal.Close asChild>
                                <Button>Save changes</Button>
                              </Modal.Close>
                            </Modal.Footer>
                          </Modal.Content>
                        </Modal>
                      </motion.div>

                      <motion.div
                        className={styles.modalInspector}
                        variants={shouldReduceMotion ? undefined : listVariants}
                      >
                        <motion.div
                          variants={
                            shouldReduceMotion ? undefined : itemVariants
                          }
                        >
                          <span>Focus trap</span>
                          <strong>Enabled</strong>
                        </motion.div>
                        <motion.div
                          variants={
                            shouldReduceMotion ? undefined : itemVariants
                          }
                        >
                          <span>Scroll behavior</span>
                          <strong>Inside</strong>
                        </motion.div>
                        <motion.div
                          variants={
                            shouldReduceMotion ? undefined : itemVariants
                          }
                        >
                          <span>Role</span>
                          <strong>Dialog</strong>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  </motion.div>
                )}

                {activeComponent === 'input' && (
                  <motion.div
                    className={styles.inputDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <FormField
                        label='Workspace name'
                        description='Controlled value with clear action.'
                        message='Workspace name is available.'
                        messageTone='success'
                      >
                        <Input
                          value={inputValue}
                          onValueChange={setInputValue}
                          clearable
                          clearIconTone='default'
                        />
                      </FormField>
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <FormField
                        label='Domain'
                        description='Segmented addons stay attached to the field.'
                        labelAction={
                          <Button appearance='link' color='neutral' size='sm'>
                            Manage
                          </Button>
                        }
                      >
                        <Input
                          startAddon='https://'
                          endAddon='.com'
                          placeholder='vellira'
                        />
                      </FormField>
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <FormField
                        label='Phone'
                        description='Mask keeps typed digits in a known format.'
                        message='This number can receive verification codes.'
                        messageTone='neutral'
                      >
                        <Input
                          type='tel'
                          mask='+33 # ## ## ## ##'
                          placeholder='+33 6 00 00 00 00'
                        />
                      </FormField>
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <FormField
                        label='Project slug'
                        message='Lower priority message is replaced by error.'
                        error='This slug is already used.'
                      >
                        <Input
                          defaultValue='vellira-ui'
                          prefix='@'
                          endIcon={<Check size={14} />}
                          endIconTone='success'
                        />
                      </FormField>
                    </motion.div>
                  </motion.div>
                )}

                {activeComponent === 'tabs' && (
                  <Tabs
                    value={tabValue}
                    onValueChange={setTabValue}
                    variant='segmented'
                  >
                    <Tabs.List aria-label='Component preview modes'>
                      <Tabs.Trigger value='preview'>Overview</Tabs.Trigger>
                      <Tabs.Trigger value='code'>Activity</Tabs.Trigger>
                      <Tabs.Trigger value='tokens'>Tokens</Tabs.Trigger>
                      <Tabs.Indicator />
                    </Tabs.List>

                    <Tabs.Content value='preview'>
                      <div className={styles.previewPage}>
                        <div className={styles.previewPageHeader}>
                          <div>
                            <span className={styles.pageEyebrow}>
                              Live preview
                            </span>
                            <strong>Workspace settings</strong>
                          </div>

                          <Button size='sm' iconStart={<Check />}>
                            Healthy
                          </Button>
                        </div>

                        <div className={styles.metricGrid}>
                          <div>
                            <span>Coverage</span>
                            <strong>98%</strong>
                          </div>
                          <div>
                            <span>Components</span>
                            <strong>42</strong>
                          </div>
                          <div>
                            <span>Themes</span>
                            <strong>3</strong>
                          </div>
                        </div>

                        <div className={styles.statusList}>
                          <span>React and React Native APIs aligned</span>
                          <span>Token outputs generated</span>
                          <span>Docs examples synced</span>
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value='code'>
                      <div className={styles.activityPage}>
                        <div className={styles.activityItem}>
                          <Check />
                          <div>
                            <strong>Public API check passed</strong>
                            <span>New icon exports are registered.</span>
                          </div>
                        </div>
                        <div className={styles.activityItem}>
                          <Upload />
                          <div>
                            <strong>Storybook snapshot uploaded</strong>
                            <span>Chromatic baseline is ready.</span>
                          </div>
                        </div>
                        <div className={styles.activityItem}>
                          <File />
                          <div>
                            <strong>Docs examples generated</strong>
                            <span>API tables match component props.</span>
                          </div>
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value='tokens'>
                      <div className={styles.tokensPage}>
                        <div className={styles.tokenRow}>
                          <span className={styles.primarySwatch} />
                          <div>
                            <strong>Primary</strong>
                            <code>--color-primary-500</code>
                          </div>
                        </div>

                        <div className={styles.tokenRow}>
                          <span className={styles.surfaceSwatch} />
                          <div>
                            <strong>Surface</strong>
                            <code>--surface-default</code>
                          </div>
                        </div>

                        <div className={styles.tokenRow}>
                          <span className={styles.borderSwatch} />
                          <div>
                            <strong>Border</strong>
                            <code>--border-muted</code>
                          </div>
                        </div>
                      </div>
                    </Tabs.Content>
                  </Tabs>
                )}

                {activeComponent === 'checkbox' && (
                  <motion.div
                    className={styles.checkboxDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <motion.div
                      className={styles.choiceHeader}
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <span className={styles.pageEyebrow}>Release gates</span>
                      <strong>Publish checklist</strong>
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Checkbox
                        wrapperClassName={styles.choiceCard}
                        label='Notify reviewers'
                        description='Send an update when the preview is ready.'
                        checked={checkboxChecked}
                        onCheckedChange={setCheckboxChecked}
                        color='primary'
                      />
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Checkbox
                        wrapperClassName={styles.choiceCard}
                        label='Require visual approval'
                        description='Hold release until Chromatic is reviewed.'
                        defaultChecked
                        color='success'
                      />
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Checkbox
                        wrapperClassName={styles.choiceCard}
                        label='Block on token drift'
                        description='Prevent publishing when generated tokens differ.'
                        indeterminate
                        color='warning'
                      />
                    </motion.div>

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Checkbox
                        wrapperClassName={styles.choiceCard}
                        label='Legacy export path'
                        description='Disabled option remains readable.'
                        disabled
                        color='neutral'
                      />
                    </motion.div>
                  </motion.div>
                )}

                {activeComponent === 'radio' && (
                  <motion.div
                    className={styles.radioDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    <RadioGroup
                      label='Component release channel'
                      size='md'
                      color='primary'
                      value={radioValue}
                      onValueChange={setRadioValue}
                    >
                      <motion.div
                        variants={shouldReduceMotion ? undefined : itemVariants}
                      >
                        <Radio
                          value='starter'
                          size='md'
                          wrapperClassName={styles.radioChoiceCard}
                          label='Canary'
                          description='Ship every merged change to an internal preview.'
                          color='warning'
                        />
                      </motion.div>

                      <motion.div
                        variants={shouldReduceMotion ? undefined : itemVariants}
                      >
                        <Radio
                          value='pro'
                          size='md'
                          wrapperClassName={styles.radioChoiceCard}
                          label='Stable'
                          description='Publish after typecheck, smoke, and visual review.'
                          color='success'
                        />
                      </motion.div>

                      <motion.div
                        variants={shouldReduceMotion ? undefined : itemVariants}
                      >
                        <Radio
                          value='enterprise'
                          size='md'
                          wrapperClassName={styles.radioChoiceCard}
                          label='Long-term support'
                          description='Patch only critical fixes for production apps.'
                          color='primary'
                        />
                      </motion.div>
                    </RadioGroup>
                  </motion.div>
                )}

                {activeComponent === 'tooltip' && (
                  <motion.div
                    className={styles.tooltipDemo}
                    variants={shouldReduceMotion ? undefined : listVariants}
                    initial={shouldReduceMotion ? undefined : 'hidden'}
                    animate={shouldReduceMotion ? undefined : 'visible'}
                  >
                    {(
                      [
                        ['Top', 'top', 'Useful for compact icon buttons.'],
                        ['Right', 'right', 'Good for toolbar labels.'],
                        ['Bottom', 'bottom', 'Default help below a control.'],
                        ['Left', 'left', 'Works for right-aligned actions.'],
                      ] as const
                    ).map(([label, placement, content]) => (
                      <motion.div
                        key={placement}
                        variants={shouldReduceMotion ? undefined : itemVariants}
                      >
                        <Tooltip
                          placement={placement}
                          delay={{ open: 120, close: 80 }}
                        >
                          <Tooltip.Trigger asChild>
                            <Button appearance='outline' color='neutral'>
                              {label}
                            </Button>
                          </Tooltip.Trigger>
                          <Tooltip.Content withArrow>{content}</Tooltip.Content>
                        </Tooltip>
                      </motion.div>
                    ))}

                    <motion.div
                      variants={shouldReduceMotion ? undefined : itemVariants}
                    >
                      <Tooltip placement='top' interactive>
                        <Tooltip.Trigger asChild>
                          <Button iconStart={<Share />}>Share</Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content withArrow>
                          Invite teammates or copy a public preview link.
                        </Tooltip.Content>
                      </Tooltip>
                    </motion.div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div
            className={styles.footer}
            variants={shouldReduceMotion ? undefined : panelReveal}
            initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
            whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.48,
              duration: shouldReduceMotion ? 0.12 : 0.52,
              ease: revealEase,
            }}
            viewport={{ once: true }}
          >
            Production ready • TypeScript • Tree-shakeable • Accessible
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
