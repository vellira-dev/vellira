'use client';

import { useMemo, useState } from 'react';

import {
  ChevronDown,
  Check,
  Copy as CopyIcon,
  Edit,
  Monitor,
  Settings,
  Smartphone,
  Trash,
} from '@vellira-ui/icons';
import {
  Button,
  Dropdown,
  FormField,
  Input,
  Modal,
  Portal,
  Tabs,
} from '@vellira-ui/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import styles from './CodeShowcase.module.css';

type Platform = 'react' | 'native';
type ExampleName = 'button' | 'input' | 'modal' | 'dropdown';
type TokenKind = 'keyword' | 'component' | 'prop' | 'string' | 'punctuation';

const exampleNames: ExampleName[] = ['button', 'input', 'modal', 'dropdown'];

const exampleLabels: Record<ExampleName, string> = {
  button: 'Button',
  input: 'Input',
  modal: 'Modal',
  dropdown: 'Dropdown',
};

const docsLinks: Record<ExampleName, string> = {
  button: 'https://docs.vellira.dev/components/button',
  input: 'https://docs.vellira.dev/components/input',
  modal: 'https://docs.vellira.dev/components/modal',
  dropdown: 'https://docs.vellira.dev/components/dropdown',
};

const storybookLinks: Record<ExampleName, string> = {
  button: 'https://storybook.vellira.dev/?path=/docs/primitives-button--docs',
  input: 'https://storybook.vellira.dev/?path=/docs/primitives-input--docs',
  modal: 'https://storybook.vellira.dev/?path=/docs/components-modal--docs',
  dropdown:
    'https://storybook.vellira.dev/?path=/docs/components-dropdown--docs',
};

const featureItems = [
  'TypeScript',
  'Accessible',
  'Tree-shakeable',
  'Theme-aware',
] as const;

const activeLineByExample: Record<ExampleName, number> = {
  button: 5,
  input: 9,
  modal: 8,
  dropdown: 6,
};

const syntaxPattern =
  /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:import|from|export|function|return|const|let|if)\b|<\/?[A-Z][\w.]*(?=[\s>/])|\b[A-Z][\w.]*(?=\()|\b[a-zA-Z][\w-]*(?==)|[{}()[\].,;=<>/]+)/g;

const isPlatform = (value: string): value is Platform =>
  value === 'react' || value === 'native';

const isExampleName = (value: string): value is ExampleName =>
  exampleNames.includes(value as ExampleName);

function getPackageName(platform: Platform) {
  return platform === 'react'
    ? '@vellira-ui/react'
    : '@vellira-ui/react-native';
}

function getTokenKind(value: string): TokenKind {
  if (/^['"]/.test(value)) {
    return 'string';
  }

  if (/^(import|from|export|function|return|const|let|if)$/.test(value)) {
    return 'keyword';
  }

  if (/^<\/?[A-Z]/.test(value) || /^[A-Z][\w.]*$/.test(value)) {
    return 'component';
  }

  if (/^[a-zA-Z][\w-]*$/.test(value)) {
    return 'prop';
  }

  return 'punctuation';
}

function renderHighlightedCode(code: string, activeLine: number) {
  return code.split('\n').map((line, lineIndex) => {
    const parts: Array<{ value: string; kind?: TokenKind }> = [];
    let lastIndex = 0;
    const showCursor = line.trim() === 'Continue';

    for (const match of line.matchAll(syntaxPattern)) {
      const value = match[0];
      const index = match.index ?? 0;

      if (index > lastIndex) {
        parts.push({ value: line.slice(lastIndex, index) });
      }

      parts.push({ value, kind: getTokenKind(value) });
      lastIndex = index + value.length;
    }

    if (lastIndex < line.length) {
      parts.push({ value: line.slice(lastIndex) });
    }

    return (
      <span key={`${line}-${lineIndex}`} className={styles.codeLine}>
        {lineIndex + 1 === activeLine && (
          <motion.span
            layoutId='code-active-line'
            className={styles.activeLine}
            transition={{
              duration: 0.34,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        )}

        <span className={styles.lineNumber}>
          {String(lineIndex + 1).padStart(2, '0')}
        </span>

        <span className={styles.lineContent}>
          {parts.length === 0
            ? '\u00A0'
            : parts.map((part, partIndex) => (
                <span
                  key={`${part.value}-${partIndex}`}
                  className={part.kind ? styles[part.kind] : undefined}
                >
                  {part.value}
                </span>
              ))}
          {showCursor && <span className={styles.cursor} aria-hidden='true' />}
        </span>
      </span>
    );
  });
}

function getCode(platform: Platform, example: ExampleName) {
  const packageName = getPackageName(platform);

  if (example === 'button') {
    return `import { Button } from '${packageName}';

export function Example() {
  return (
    <Button color='primary'>
      Continue
    </Button>
  );
}`;
  }

  if (example === 'input') {
    return `import { FormField, Input } from '${packageName}';

export function Example() {
  return (
    <FormField
      id='workspace'
    >
      <FormField.Label>Workspace name</FormField.Label>
      <FormField.Description>
        Visible to your team.
      </FormField.Description>
      <FormField.Control>
        <Input placeholder='Vellira workspace' />
      </FormField.Control>
      <FormField.Message tone='success'>
        Workspace name is available.
      </FormField.Message>
    </FormField>
  );
}`;
  }

  if (example === 'modal') {
    return `import {
  Button,
  Modal,
  Portal,
} from '${packageName}';

export function Example() {
  return (
    <Modal
      animation='scale'
      duration={{ open: 180, close: 150 }}
    >
      <Modal.Trigger asChild>
        <Button>Open modal</Button>
      </Modal.Trigger>

      <Portal>
        <Modal.Overlay />
        <Modal.Content>
          <Modal.Header>
            <div>
              <Modal.Title>Create workspace</Modal.Title>
              <Modal.Description>
                Start with shared components.
              </Modal.Description>
            </div>
            <Modal.Close />
          </Modal.Header>
        </Modal.Content>
      </Portal>
    </Modal>
  );
}`;
  }

  return `import {
  Button,
  Dropdown,
} from '${packageName}';

export function Example() {
  return (
    <Dropdown placement='bottom-end'>
      <Dropdown.Trigger asChild>
        <Button>Actions</Button>
      </Dropdown.Trigger>

      <Dropdown.Content>
        <Dropdown.Item>
          Edit workspace
        </Dropdown.Item>

        <Dropdown.Item>
          Duplicate workspace
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  );
}`;
}

const revealTransition = {
  ease: [0.16, 1, 0.3, 1],
} as const;

const workspaceVariants = {
  hidden: {
    opacity: 0,
    y: 90,
    scale: 0.96,
    filter: 'blur(14px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.82,
      ease: revealTransition.ease,
      staggerChildren: 0.13,
      delayChildren: 0.12,
    },
  },
};

const panelVariants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.46,
      ease: revealTransition.ease,
    },
  },
};

const editorVariants = {
  hidden: {
    opacity: 0,
    x: -80,
    rotateY: 8,
    filter: 'blur(12px)',
  },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.68,
      ease: revealTransition.ease,
    },
  },
};

const previewVariants = {
  hidden: {
    opacity: 0,
    x: 80,
    rotateY: -8,
    scale: 0.96,
    filter: 'blur(12px)',
  },
  visible: {
    opacity: 1,
    x: 0,
    rotateY: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.68,
      ease: revealTransition.ease,
    },
  },
};

// Restore every reveal property when the reduced-motion preference hydrates.
// Removing variants alone can leave inherited server-rendered hidden styles.
const reducedMotionReveal = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotateY: 0,
  filter: 'blur(0px)',
  transition: { duration: 0 },
};

export function CodeShowcase() {
  const shouldReduceMotion = useReducedMotion();

  const [platform, setPlatform] = useState<Platform>('react');
  const [activeExample, setActiveExample] = useState<ExampleName>('button');
  const [modalOpen, setModalOpen] = useState(false);
  const [workspace, setWorkspace] = useState('Vellira workspace');
  const [copied, setCopied] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const code = useMemo(
    () => getCode(platform, activeExample),
    [platform, activeExample]
  );

  const installCommand = `pnpm add ${getPackageName(platform)}`;
  const activeLabel = exampleLabels[activeExample];
  const activeLine = activeLineByExample[activeExample];

  const copyText = async (
    value: string,
    onCopiedChange: (copied: boolean) => void
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      onCopiedChange(true);

      window.setTimeout(() => {
        onCopiedChange(false);
      }, 1600);
    } catch {
      onCopiedChange(false);
    }
  };

  return (
    <section
      id='code'
      className={styles.section}
      aria-labelledby='code-showcase-title'
    >
      <div className={styles.glow} aria-hidden='true' />

      <div className={styles.container}>
        <motion.header
          className={styles.header}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.75,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className={styles.eyebrow}>Developer experience</span>

          <h2 id='code-showcase-title' className={styles.title}>
            Write less.
            <span>Ship everywhere.</span>
          </h2>

          <p className={styles.description}>
            Move between React and React Native without learning two unrelated
            component systems. The package changes. The mental model stays.
          </p>
        </motion.header>

        <motion.div
          className={styles.showcase}
          variants={shouldReduceMotion ? undefined : workspaceVariants}
          animate={shouldReduceMotion ? reducedMotionReveal : undefined}
          initial={shouldReduceMotion ? { opacity: 0 } : 'hidden'}
          whileInView={shouldReduceMotion ? { opacity: 1 } : 'visible'}
          transition={shouldReduceMotion ? { duration: 0.2 } : undefined}
          viewport={{ once: true, amount: 0.18 }}
        >
          <motion.div
            className={styles.toolbar}
            variants={shouldReduceMotion ? undefined : panelVariants}
            animate={shouldReduceMotion ? reducedMotionReveal : undefined}
          >
            <Tabs
              value={platform}
              onValueChange={(value) => {
                if (isPlatform(value)) {
                  setPlatform(value);
                }
              }}
              variant='segmented'
            >
              <Tabs.List aria-label='Code platform'>
                <Tabs.Trigger value='react' icon={<Monitor />}>
                  React
                </Tabs.Trigger>
                <Tabs.Trigger value='native' icon={<Smartphone />}>
                  React Native
                </Tabs.Trigger>
                <Tabs.Indicator />
              </Tabs.List>

              <Tabs.Content value='react'>
                <span className={styles.visuallyHidden}>
                  React code selected
                </span>
              </Tabs.Content>

              <Tabs.Content value='native'>
                <span className={styles.visuallyHidden}>
                  React Native code selected
                </span>
              </Tabs.Content>
            </Tabs>

            <div
              className={styles.examplePicker}
              role='group'
              aria-label='Code examples'
            >
              {exampleNames.map((example) => (
                <Button
                  key={example}
                  type='button'
                  appearance='bare'
                  aria-pressed={activeExample === example}
                  className={
                    activeExample === example
                      ? styles.activeExample
                      : styles.exampleButton
                  }
                  onClick={() => {
                    if (isExampleName(example)) {
                      setActiveExample(example);
                    }
                  }}
                >
                  {example.charAt(0).toUpperCase() + example.slice(1)}
                </Button>
              ))}
            </div>
          </motion.div>

          <div className={styles.workspace}>
            <motion.div
              className={styles.editor}
              variants={shouldReduceMotion ? undefined : editorVariants}
              animate={shouldReduceMotion ? reducedMotionReveal : undefined}
            >
              <div className={styles.editorHeader}>
                <div className={styles.fileMeta}>
                  <span className={styles.fileDot} aria-hidden='true' />
                  <AnimatePresence mode='wait' initial={false}>
                    <motion.span
                      key={activeLabel}
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: 4, filter: 'blur(3px)' }
                      }
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, y: -4, filter: 'blur(3px)' }
                      }
                      transition={{
                        duration: shouldReduceMotion ? 0.12 : 0.24,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {activeLabel}.tsx
                    </motion.span>
                  </AnimatePresence>
                </div>

                <Button
                  size='sm'
                  appearance='ghost'
                  color='neutral'
                  iconStart={<CopyIcon />}
                  onClick={() => {
                    void copyText(code, setCopied);
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <div className={styles.codeViewport}>
                <AnimatePresence mode='wait' initial={false}>
                  <motion.pre
                    key={`${platform}-${activeExample}`}
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 24,
                            scale: 0.985,
                            filter: 'blur(8px)',
                          }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: shouldReduceMotion ? 1 : [1.02, 1],
                      filter: 'blur(0px)',
                    }}
                    exit={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -24,
                            scale: 0.985,
                            filter: 'blur(8px)',
                          }
                    }
                    transition={{
                      delay: shouldReduceMotion ? 0 : 0.06,
                      duration: shouldReduceMotion ? 0.12 : 0.36,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <code>{renderHighlightedCode(code, activeLine)}</code>
                  </motion.pre>
                </AnimatePresence>
              </div>

              <div className={styles.importDifference}>
                <span>Only the package changes</span>

                <AnimatePresence mode='wait' initial={false}>
                  <motion.code
                    key={platform}
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            x: platform === 'react' ? -10 : 10,
                            filter: 'blur(4px)',
                          }
                    }
                    animate={{
                      opacity: 1,
                      x: 0,
                      filter: 'blur(0px)',
                    }}
                    exit={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            x: platform === 'react' ? 10 : -10,
                            filter: 'blur(4px)',
                          }
                    }
                    transition={{
                      duration: shouldReduceMotion ? 0.12 : 0.24,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {getPackageName(platform)}
                  </motion.code>
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.div
              className={styles.preview}
              variants={shouldReduceMotion ? undefined : previewVariants}
              animate={shouldReduceMotion ? reducedMotionReveal : undefined}
            >
              <div className={styles.previewHeader}>
                <div>
                  <span className={styles.previewLabel}>Live preview</span>
                  <strong>{activeLabel}</strong>
                </div>

                <div className={styles.previewBadges}>
                  <span className={styles.previewStatus}>
                    <span aria-hidden='true' />
                    Interactive
                  </span>

                  <span className={styles.platformBadge}>
                    {platform === 'react' ? 'Web preview' : 'Native preview'}
                  </span>
                </div>
              </div>

              <div className={styles.previewStage}>
                <AnimatePresence mode='wait' initial={false}>
                  <motion.div
                    key={activeExample}
                    className={styles.previewContent}
                    initial={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: 28,
                            scale: 0.92,
                            filter: 'blur(10px)',
                          }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: 'blur(0px)',
                    }}
                    exit={
                      shouldReduceMotion
                        ? { opacity: 0 }
                        : {
                            opacity: 0,
                            y: -24,
                            scale: 0.96,
                            filter: 'blur(8px)',
                          }
                    }
                    transition={{
                      delay: shouldReduceMotion ? 0 : 0.1,
                      duration: shouldReduceMotion ? 0.12 : 0.4,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {activeExample === 'button' && (
                      <div className={styles.previewCard}>
                        <div className={styles.previewCardHeader}>
                          <span>Checkout</span>
                          <strong>Workspace Pro</strong>
                        </div>

                        <div className={styles.planSummary}>
                          <div>
                            <span>Monthly total</span>
                            <strong>$48</strong>
                          </div>
                          <p>
                            Includes team seats, design tokens, and support.
                          </p>
                        </div>

                        <div className={styles.buttonStack}>
                          <span className={styles.primaryAction}>
                            <Button color='primary'>Continue</Button>
                          </span>
                          <Button appearance='outline' color='neutral'>
                            Review plan
                          </Button>
                        </div>
                      </div>
                    )}

                    {activeExample === 'input' && (
                      <div className={styles.previewCard}>
                        <div className={styles.previewCardHeader}>
                          <span>Project setup</span>
                          <strong>Workspace details</strong>
                        </div>

                        <FormField id='workspace'>
                          <FormField.Label>Workspace name</FormField.Label>
                          <FormField.Description>
                            Visible to your team.
                          </FormField.Description>
                          <FormField.Control>
                            <Input
                              value={workspace}
                              onValueChange={setWorkspace}
                            />
                          </FormField.Control>
                          <FormField.Message tone='success'>
                            Workspace name is available.
                          </FormField.Message>
                        </FormField>

                        <div className={styles.fieldMeta}>
                          <span aria-hidden='true' />
                          Synced controlled value
                        </div>
                      </div>
                    )}

                    {activeExample === 'modal' && (
                      <div className={styles.previewCard}>
                        <div className={styles.previewCardHeader}>
                          <span>Launch flow</span>
                          <strong>Guarded action</strong>
                        </div>

                        <p className={styles.previewCopy}>
                          Open a real Modal composed from Header, Body, Footer,
                          Title, Description, and Close.
                        </p>

                        <Button
                          onClick={() => {
                            setModalOpen(true);
                          }}
                        >
                          Open modal
                        </Button>

                        <Modal
                          open={modalOpen}
                          animation='scale'
                          duration={{ open: 180, close: 150 }}
                          onOpenChange={setModalOpen}
                        >
                          <Portal>
                            <Modal.Overlay />
                            <Modal.Content>
                              <Modal.Header>
                                <div>
                                  <Modal.Title>Create workspace</Modal.Title>

                                  <Modal.Description>
                                    Start with shared components and design
                                    tokens.
                                  </Modal.Description>
                                </div>
                                <Modal.Close />
                              </Modal.Header>

                              <Modal.Body>
                                <FormField label='Workspace name'>
                                  <Input defaultValue='Vellira workspace' />
                                </FormField>
                              </Modal.Body>

                              <Modal.Footer>
                                <Modal.Close asChild>
                                  <Button appearance='ghost' color='neutral'>
                                    Cancel
                                  </Button>
                                </Modal.Close>

                                <Modal.Close asChild>
                                  <Button>Create</Button>
                                </Modal.Close>
                              </Modal.Footer>
                            </Modal.Content>
                          </Portal>
                        </Modal>
                      </div>
                    )}

                    {activeExample === 'dropdown' && (
                      <div className={styles.previewCard}>
                        <div className={styles.previewCardHeader}>
                          <span>Workspace</span>
                          <strong>Actions menu</strong>
                        </div>

                        <div className={styles.dropdownSurface}>
                          <div>
                            <span>Vellira workspace</span>
                            <strong>Ready</strong>
                          </div>

                          <Dropdown placement='bottom-end'>
                            <Dropdown.Trigger asChild>
                              <Button
                                appearance='outline'
                                color='neutral'
                                iconEnd={<ChevronDown />}
                              >
                                Actions
                              </Button>
                            </Dropdown.Trigger>

                            <Dropdown.Content>
                              <Dropdown.Label>Workspace actions</Dropdown.Label>

                              <Dropdown.Item icon={<Edit />}>
                                Edit workspace
                              </Dropdown.Item>
                              <Dropdown.Item icon={<CopyIcon />}>
                                Duplicate workspace
                              </Dropdown.Item>
                              <Dropdown.Item icon={<Settings />}>
                                Export configuration
                              </Dropdown.Item>

                              <Dropdown.Separator />

                              <Dropdown.Item color='danger' icon={<Trash />}>
                                Delete workspace
                              </Dropdown.Item>
                            </Dropdown.Content>
                          </Dropdown>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          <motion.div
            className={styles.installBar}
            variants={shouldReduceMotion ? undefined : panelVariants}
            animate={shouldReduceMotion ? reducedMotionReveal : undefined}
          >
            <div className={styles.command}>
              <span aria-hidden='true'>$</span>
              <code>{installCommand}</code>
            </div>

            <Button
              size='sm'
              appearance='outline'
              color='neutral'
              className={styles.installAction}
              onClick={() => {
                void copyText(installCommand, setCommandCopied);
              }}
            >
              {commandCopied ? 'Copied' : 'Copy command'}
            </Button>

            <Button
              asChild
              size='sm'
              appearance='ghost'
              color='neutral'
              className={styles.installAction}
            >
              <a
                href={docsLinks[activeExample]}
                target='_blank'
                rel='noreferrer noopener'
              >
                Docs
              </a>
            </Button>

            <Button
              asChild
              size='sm'
              appearance='ghost'
              color='neutral'
              className={styles.installAction}
            >
              <a
                href={storybookLinks[activeExample]}
                target='_blank'
                rel='noreferrer noopener'
              >
                Storybook
              </a>
            </Button>

            <ul className={styles.features} aria-label='Package features'>
              {featureItems.map((feature) => (
                <li key={feature}>
                  <Check size={13} aria-hidden='true' />
                  {feature}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

CodeShowcase.displayName = 'CodeShowcase';
