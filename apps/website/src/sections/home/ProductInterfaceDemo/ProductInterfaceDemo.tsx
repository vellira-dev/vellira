'use client';

import { type ComponentType, type SVGProps, useEffect, useState } from 'react';

import {
  ChevronDown,
  Contrast,
  Copy,
  Download,
  Grid,
  Home,
  Package,
  System,
  Trash,
} from '@vellira-ui/icons';
import Image from 'next/image';
import { Button, Checkbox, Dropdown, Input, Tabs } from '@vellira-ui/react';
import { motion, useReducedMotion } from 'motion/react';

import styles from './ProductInterfaceDemo.module.css';

type WorkspaceView = 'design' | 'code';
type WindowControlTone = 'danger' | 'warning' | 'success';
type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    color?: string;
  }
>;

type NavigationItem = {
  label: string;
  icon: IconComponent;
  badge?: string;
  active?: boolean;
};

const windowControlTones = [
  'danger',
  'warning',
  'success',
] as const satisfies readonly WindowControlTone[];

const navigationItems: readonly NavigationItem[] = [
  {
    label: 'Overview',
    icon: Home,
    active: true,
  },
  {
    label: 'Components',
    icon: Package,
    badge: '28',
  },
  {
    label: 'Tokens',
    icon: Grid,
  },
  {
    label: 'Themes',
    icon: Contrast,
  },
] as const satisfies readonly NavigationItem[];

export function ProductInterfaceDemo() {
  const shouldReduceMotion = useReducedMotion();

  const [animationStarted, setAnimationStarted] = useState(false);
  const [workspace, setWorkspace] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>('design');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [savePulse, setSavePulse] = useState(false);

  const handleViewChange = (value: string) => {
    if (value === 'design' || value === 'code') {
      setActiveView(value);
    }
  };

  const handleAnimationStart = () => {
    setAnimationStarted(true);
    setDropdownOpen(false);
    setSavePulse(false);

    if (shouldReduceMotion) {
      setWorkspace('Vellira workspace');
      setNotificationsEnabled(true);
      setActiveView('design');
      return;
    }

    setWorkspace('');
    setNotificationsEnabled(false);
    setActiveView('design');
  };

  useEffect(() => {
    if (!animationStarted || shouldReduceMotion) {
      return undefined;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let typingTimer: ReturnType<typeof setInterval> | undefined;

    const workspaceName = 'Vellira workspace';

    timers.push(
      setTimeout(() => {
        let characterIndex = 0;

        typingTimer = setInterval(() => {
          characterIndex += 1;
          setWorkspace(workspaceName.slice(0, characterIndex));

          if (characterIndex >= workspaceName.length && typingTimer) {
            clearInterval(typingTimer);
          }
        }, 105);
      }, 1400)
    );

    timers.push(
      setTimeout(() => {
        setNotificationsEnabled(true);
      }, 3600)
    );

    timers.push(
      setTimeout(() => {
        setActiveView('code');
      }, 4800)
    );

    timers.push(
      setTimeout(() => {
        setActiveView('design');
      }, 6200)
    );

    timers.push(
      setTimeout(() => {
        setSavePulse(true);
      }, 7300)
    );

    timers.push(
      setTimeout(() => {
        setSavePulse(false);
      }, 8400)
    );

    timers.push(
      setTimeout(() => {
        setDropdownOpen(true);
      }, 8900)
    );

    timers.push(
      setTimeout(() => {
        setDropdownOpen(false);
      }, 10800)
    );

    return () => {
      timers.forEach(clearTimeout);

      if (typingTimer) {
        clearInterval(typingTimer);
      }
    };
  }, [animationStarted, shouldReduceMotion]);

  return (
    <section
      id='interface'
      className={styles.section}
      aria-labelledby='product-interface-demo-title'
    >
      <motion.div
        className={styles.background}
        aria-hidden='true'
        initial={{
          opacity: 0,
          scale: 0.82,
        }}
        whileInView={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: shouldReduceMotion ? 0.2 : 1.35,
          ease: [0.16, 1, 0.3, 1],
        }}
        viewport={{ once: true, amount: 0.2 }}
      />

      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <span className={styles.eyebrow}>Component system</span>

          <h2 id='product-interface-demo-title' className={styles.title}>
            Build complete interfaces.
            <span>Not isolated components.</span>
          </h2>

          <p className={styles.description}>
            Accessible primitives, product-ready patterns and shared design
            tokens working together in one coherent interface.
          </p>
        </motion.div>

        <motion.div
          className={styles.stage}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  y: 72,
                  scale: 0.955,
                  filter: 'blur(14px)',
                }
          }
          whileInView={{
            opacity: 1,
            y: 0,
            scale: 1,
            filter: 'blur(0px)',
          }}
          onViewportEnter={handleAnimationStart}
          transition={{
            duration: shouldReduceMotion ? 0.2 : 1.05,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className={styles.windowHeader}>
            <div className={styles.windowControls} aria-hidden='true'>
              {windowControlTones.map((tone) => (
                <span
                  key={tone}
                  className={styles.previewDot}
                  data-tone={tone}
                />
              ))}
            </div>

            <span className={styles.windowTitle}>Vellira workspace</span>

            <div className={styles.liveStatus}>
              <span />
              Live preview
            </div>
          </div>

          <div className={styles.appShell}>
            <motion.aside
              className={styles.sidebar}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : {
                      opacity: 0,
                      x: -56,
                    }
              }
              whileInView={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.45,
                duration: shouldReduceMotion ? 0.2 : 1.15,
                ease: [0.16, 1, 0.3, 1],
              }}
              viewport={{ once: true, amount: 0.4 }}
            >
              <div className={styles.brand}>
                <span className={styles.brandMark} aria-hidden='true'>
                  <Image
                    src='/brand/icons/logo-icon-white.svg'
                    alt=''
                    width={24}
                    height={24}
                  />
                </span>

                <div>
                  <strong>Vellira</strong>
                  <span>Design system</span>
                </div>
              </div>

              <nav className={styles.navigation} aria-label='Demo navigation'>
                {navigationItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Button
                      key={item.label}
                      type='button'
                      appearance={item.active ? 'soft' : 'ghost'}
                      color='neutral'
                      size='sm'
                      shape='rounded'
                      fullWidth
                      badge={item.badge}
                      className={
                        item.active
                          ? styles.activeNavigationItem
                          : styles.navigationItem
                      }
                    >
                      <span className={styles.navigationContent}>
                        <Icon
                          className={styles.navigationIcon}
                          aria-hidden='true'
                        />
                        {item.label}
                      </span>
                    </Button>
                  );
                })}
              </nav>

              <div className={styles.sidebarFooter}>
                <div className={styles.avatar}>RB</div>

                <div>
                  <strong>Roman</strong>
                  <span>Workspace owner</span>
                </div>
              </div>
            </motion.aside>

            <main className={styles.workspace}>
              <div className={styles.workspaceHeader}>
                <div>
                  <span className={styles.sectionLabel}>Workspace</span>
                  <h3>General settings</h3>
                  <p>Manage your workspace details and preferences.</p>
                </div>

                <Dropdown
                  open={dropdownOpen}
                  onOpenChange={setDropdownOpen}
                  placement='bottom-end'
                >
                  <Dropdown.Trigger asChild>
                    <Button
                      appearance='outline'
                      color='neutral'
                      size='sm'
                      iconEnd={<ChevronDown />}
                      className={styles.headerAction}
                    >
                      Actions
                    </Button>
                  </Dropdown.Trigger>

                  <Dropdown.Content>
                    <Dropdown.Label>Workspace actions</Dropdown.Label>

                    <Dropdown.Item icon={<Copy />}>
                      Duplicate workspace
                    </Dropdown.Item>
                    <Dropdown.Item icon={<Download />}>
                      Export configuration
                    </Dropdown.Item>

                    <Dropdown.Separator />

                    <Dropdown.Item color='danger' icon={<Trash />}>
                      Delete workspace
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown>
              </div>

              <div className={styles.workspaceBody}>
                <motion.div
                  className={styles.settingsCard}
                  initial={
                    shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }
                  }
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.3,
                    duration: 0.55,
                  }}
                  viewport={{ once: true }}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.sectionLabel}>Identity</span>
                      <h4>Workspace profile</h4>
                    </div>

                    <span className={styles.savedBadge}>Autosaved</span>
                  </div>

                  <div className={styles.form}>
                    <Input
                      label='Workspace name'
                      value={workspace}
                      onValueChange={setWorkspace}
                      description='Visible to everyone in your workspace.'
                    />

                    <Checkbox
                      label='Enable notifications'
                      description='Receive product updates and workspace activity.'
                      checked={notificationsEnabled}
                      onCheckedChange={setNotificationsEnabled}
                    />

                    <div className={styles.viewControl}>
                      <span className={styles.controlLabel}>Default view</span>

                      <Tabs
                        value={activeView}
                        onValueChange={handleViewChange}
                        variant='segmented'
                      >
                        <Tabs.List aria-label='Default workspace view'>
                          <Tabs.Trigger value='design'>Design</Tabs.Trigger>
                          <Tabs.Trigger value='code'>Code</Tabs.Trigger>
                          <Tabs.Indicator />
                        </Tabs.List>

                        <Tabs.Content value='design'>
                          <span className={styles.visuallyHidden}>
                            Design view selected
                          </span>
                        </Tabs.Content>

                        <Tabs.Content value='code'>
                          <span className={styles.visuallyHidden}>
                            Code view selected
                          </span>
                        </Tabs.Content>
                      </Tabs>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <Button appearance='ghost' color='neutral'>
                      Cancel
                    </Button>

                    <motion.div
                      className={styles.saveAction}
                      animate={
                        savePulse && !shouldReduceMotion
                          ? {
                              scale: [1, 1.045, 1],
                              y: [0, -2, 0],
                            }
                          : {
                              scale: 1,
                              y: 0,
                            }
                      }
                      transition={{
                        duration: 1,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Button>Save changes</Button>
                    </motion.div>
                  </div>
                </motion.div>

                <motion.aside
                  className={styles.inspector}
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          x: 56,
                          scale: 0.97,
                        }
                  }
                  whileInView={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.7,
                    duration: shouldReduceMotion ? 0.2 : 1.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  viewport={{ once: true, amount: 0.35 }}
                >
                  <div className={styles.inspectorHeader}>
                    <span className={styles.sectionLabel}>Live preview</span>
                    <span className={styles.onlineIndicator}>Online</span>
                  </div>

                  <div className={styles.workspacePreview}>
                    <div className={styles.workspaceAvatar} aria-hidden='true'>
                      <Image
                        src='/brand/icons/logo-icon-white.svg'
                        alt=''
                        width={24}
                        height={24}
                      />
                    </div>

                    <div>
                      <strong>{workspace || 'Untitled workspace'}</strong>
                      <span>Production workspace</span>
                    </div>
                  </div>

                  <dl className={styles.details}>
                    <div>
                      <dt>Platform</dt>
                      <dd>Web + Native</dd>
                    </div>

                    <div>
                      <dt>Notifications</dt>
                      <dd>{notificationsEnabled ? 'Enabled' : 'Disabled'}</dd>
                    </div>

                    <div>
                      <dt>Default view</dt>
                      <dd>{activeView === 'design' ? 'Design' : 'Code'}</dd>
                    </div>

                    <div>
                      <dt>Status</dt>
                      <dd className={styles.successText}>Active</dd>
                    </div>
                  </dl>

                  <div className={styles.inspectorFooter}>
                    <span>Shared API</span>
                    <strong>
                      <System aria-hidden='true' />
                      React · React Native
                    </strong>
                  </div>
                </motion.aside>
              </div>
            </main>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

ProductInterfaceDemo.displayName = 'ProductInterfaceDemo';
