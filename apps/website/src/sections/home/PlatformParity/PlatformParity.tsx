'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  Grid,
  Monitor,
  Settings,
  Smartphone,
  System,
  Users,
} from '@vellira-ui/icons';
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  Radio,
  RadioGroup,
  Select,
  Tabs,
  useTheme,
} from '@vellira-ui/react';

import styles from './PlatformParity.module.css';

type PlatformPreviewTab = 'overview' | 'permissions';
type PreviewDensity = 'comfortable' | 'compact';
type TeamValue = 'design' | 'platform' | 'mobile';
type PreviewTheme = 'light' | 'dark' | 'high-contrast';

type NativePreviewMessage = {
  source: 'vellira-website';
  type: 'sync-preview';
  payload: {
    workspace: string;
    notificationsEnabled: boolean;
    activeTab: PlatformPreviewTab;
    density: PreviewDensity;
    team: TeamValue;
    theme: PreviewTheme;
  };
};

const NATIVE_PREVIEW_URL = 'https://native.vellira.dev';
const NATIVE_PREVIEW_ORIGIN = new URL(NATIVE_PREVIEW_URL).origin;

const isPlatformPreviewTab = (value: string): value is PlatformPreviewTab =>
  value === 'overview' || value === 'permissions';

const isPreviewDensity = (value: string): value is PreviewDensity =>
  value === 'comfortable' || value === 'compact';

const isTeamValue = (value: string): value is TeamValue =>
  value === 'design' || value === 'platform' || value === 'mobile';

const sharedApi = [
  {
    icon: <ArrowLeftRight />,
    label: 'State',
    title: 'Familiar controlled-state patterns',
    description:
      'Shared state concepts make both renderers familiar. Exact props and interaction details remain platform-specific.',
  },
  {
    icon: <Grid />,
    label: 'Scale',
    title: 'Shared sizes and color intents',
    description:
      'Use the same size and intent vocabulary while each renderer maps it to platform primitives.',
  },
  {
    icon: <System />,
    label: 'Tokens',
    title: 'Token-backed surfaces and borders',
    description:
      'Surfaces, borders, focus rings, and shadows resolve from theme tokens instead of hard-coded color.',
  },
  {
    icon: <Smartphone />,
    label: 'Feel',
    title: 'Platform-appropriate interactions',
    description:
      'Menus, overlays and touch targets adapt to each runtime. Feature parity continues to evolve.',
  },
] as const;

export function PlatformParity() {
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  const [workspace, setWorkspace] = useState('Vellira Product Suite');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<PlatformPreviewTab>('overview');
  const [density, setDensity] = useState<PreviewDensity>('comfortable');
  const [team, setTeam] = useState<TeamValue>('design');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [nativePreviewLoaded, setNativePreviewLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const previewTheme: PreviewTheme =
    theme === 'highContrast' ? 'high-contrast' : theme;

  const selectedTeam =
    team === 'design'
      ? 'Design systems'
      : team === 'platform'
        ? 'Platform team'
        : 'Mobile squad';

  const sendPreviewState = useCallback(() => {
    const message: NativePreviewMessage = {
      source: 'vellira-website',
      type: 'sync-preview',
      payload: {
        workspace,
        notificationsEnabled,
        activeTab,
        density,
        team,
        theme: previewTheme,
      },
    };

    try {
      iframeRef.current?.contentWindow?.postMessage(
        message,
        NATIVE_PREVIEW_ORIGIN
      );
    } catch {
      // Ignore transient preview messaging failures.
    }
  }, [workspace, notificationsEnabled, activeTab, density, team, previewTheme]);

  useEffect(() => {
    if (!nativePreviewLoaded) return;

    sendPreviewState();
  }, [nativePreviewLoaded, sendPreviewState]);

  const handleNativePreviewLoad = useCallback(() => {
    setNativePreviewLoaded(true);
  }, []);

  return (
    <section
      id='platforms'
      className={styles.section}
      aria-labelledby='platform-parity-title'
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Cross-platform by design</span>

          <h2 id='platform-parity-title' className={styles.title}>
            Shared foundations.
            <span>Two native renderers.</span>
          </h2>

          <p className={styles.description}>
            React and React Native share tokens and design intent, with
            platform-appropriate implementations. Check each component's docs
            for the exact API and behavior supported on your target runtime.
          </p>
        </header>

        <div className={styles.comparison}>
          <motion.article
            className={styles.platformCard}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: -72, scale: 0.97 }
            }
            whileInView={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.35,
            }}
            transition={{
              duration: shouldReduceMotion ? 0.2 : 1.05,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className={styles.platformHeader}>
              <div>
                <span className={styles.platformLabel}>Web</span>
                <h3>React</h3>
              </div>

              <span className={styles.platformBadge}>@vellira-ui/react</span>
            </div>

            <div className={styles.preview}>
              <div className={styles.previewToolbar}>
                <div className={styles.previewTitle}>
                  <span aria-hidden='true'>
                    <Monitor />
                  </span>
                  <div>
                    <strong>Workspace settings</strong>
                    <small>Real React components</small>
                  </div>
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
                    >
                      Publish
                    </Button>
                  </Dropdown.Trigger>

                  <Dropdown.Content>
                    <Dropdown.Label>Release actions</Dropdown.Label>
                    <Dropdown.Item icon={<Copy />}>
                      Copy platform config
                    </Dropdown.Item>
                    <Dropdown.Item icon={<Download />}>
                      Export token bundle
                    </Dropdown.Item>
                    <Dropdown.Separator />
                    <Dropdown.Item icon={<Settings />}>
                      Review rollout rules
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown>
              </div>

              <Input
                label='Workspace'
                value={workspace}
                onValueChange={setWorkspace}
                description='The same controlled value updates both platform previews.'
              />

              <Select
                label='Owning team'
                value={team}
                onValueChange={(value) => {
                  if (value !== null && isTeamValue(value)) {
                    setTeam(value);
                  }
                }}
                startIcon={<Users />}
              >
                <Select.Item value='design' icon={<Grid />}>
                  Design systems
                  <Select.ItemDescription>
                    Components and foundations
                  </Select.ItemDescription>
                  <Select.ItemBadge>Core</Select.ItemBadge>
                </Select.Item>
                <Select.Item value='platform' icon={<Monitor />}>
                  Platform team
                  <Select.ItemDescription>
                    Web delivery and tooling
                  </Select.ItemDescription>
                  <Select.ItemBadge>Web</Select.ItemBadge>
                </Select.Item>
                <Select.Item value='mobile' icon={<Smartphone />}>
                  Mobile squad
                  <Select.ItemDescription>
                    Native previews and gestures
                  </Select.ItemDescription>
                  <Select.ItemBadge>RN</Select.ItemBadge>
                </Select.Item>
              </Select>

              <div className={styles.controlGrid}>
                <Checkbox
                  label='Enable notifications'
                  description='Mirrors to native switch styling.'
                  checked={notificationsEnabled}
                  onCheckedChange={setNotificationsEnabled}
                />

                <RadioGroup
                  name='preview-density'
                  label='Density'
                  value={density}
                  onValueChange={(value) => {
                    if (isPreviewDensity(value)) {
                      setDensity(value);
                    }
                  }}
                  orientation='horizontal'
                  size='sm'
                >
                  <Radio value='comfortable' label='Comfort' />
                  <Radio value='compact' label='Compact' />
                </RadioGroup>
              </div>

              <Tabs
                value={activeTab}
                onValueChange={(value) => {
                  if (isPlatformPreviewTab(value)) {
                    setActiveTab(value);
                  }
                }}
                variant='segmented'
              >
                <Tabs.List aria-label='Preview panel'>
                  <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
                  <Tabs.Trigger value='permissions'>Permissions</Tabs.Trigger>
                  <Tabs.Indicator />
                </Tabs.List>

                <Tabs.Content value='overview'>
                  <div className={styles.tabPanel}>
                    <div>
                      <span>Active team</span>
                      <strong>{selectedTeam}</strong>
                    </div>
                    <div>
                      <span>Density</span>
                      <strong>
                        {density === 'comfortable' ? 'Comfort' : 'Compact'}
                      </strong>
                    </div>
                  </div>
                </Tabs.Content>

                <Tabs.Content value='permissions'>
                  <div className={styles.tabPanel}>
                    <div>
                      <span>Role</span>
                      <strong>Owner</strong>
                    </div>
                    <div>
                      <span>Release</span>
                      <strong>Protected</strong>
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs>

              <div className={styles.previewActions}>
                <Button iconStart={<Check />}>Sync changes</Button>
                <Button appearance='ghost' color='neutral'>
                  Preview API
                </Button>
              </div>
            </div>
          </motion.article>

          <motion.div
            className={styles.bridge}
            aria-hidden='true'
            initial={{
              opacity: 0,
              scale: shouldReduceMotion ? 1 : 0.72,
            }}
            whileInView={{
              opacity: 1,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.5,
            }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.3,
              duration: shouldReduceMotion ? 0.2 : 0.7,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <span className={styles.bridgeLine} />
            <span className={styles.bridgeIcon}>
              <ArrowLeftRight aria-hidden='true' />
            </span>
            <span className={styles.bridgePulse} />
            <span className={styles.bridgePulseReverse} />
            <span className={styles.bridgeLine} />
          </motion.div>

          <motion.article
            className={styles.platformCard}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    x: 72,
                    scale: 0.94,
                  }
            }
            whileInView={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            viewport={{
              once: true,
              amount: 0.35,
            }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.18,
              duration: shouldReduceMotion ? 0.2 : 1.15,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className={styles.platformHeader}>
              <div>
                <span className={styles.platformLabel}>Native</span>
                <h3>React Native</h3>
              </div>

              <span className={styles.platformBadge}>
                @vellira-ui/react-native
              </span>
            </div>

            <div className={styles.phoneStage}>
              <div className={styles.phone}>
                <div className={styles.phoneFrame}>
                  <div className={styles.phoneIsland} aria-hidden='true' />

                  <iframe
                    ref={iframeRef}
                    className={styles.phoneScreen}
                    src={NATIVE_PREVIEW_URL}
                    title='Vellira React Native preview'
                    loading='lazy'
                    onLoad={handleNativePreviewLoad}
                  />
                </div>
              </div>
            </div>
          </motion.article>
        </div>

        <div className={styles.featuresWrap}>
          <div className={styles.featuresHeader}>
            <span className={styles.featuresLabel}>Shared contract</span>
            <h3>One state. Native rendering.</h3>
            <p>
              This synchronized preview illustrates shared state and design
              intent. It does not claim identical behavior for every component.
            </p>
          </div>

          <ul className={styles.features} aria-label='Shared platform contract'>
            {sharedApi.map((feature, index) => (
              <motion.li
                key={feature.title}
                initial={
                  shouldReduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -46, scale: 0.98 }
                }
                whileInView={{
                  opacity: 1,
                  x: 0,
                  scale: 1,
                }}
                viewport={{
                  once: true,
                  amount: 0.35,
                }}
                transition={{
                  delay: shouldReduceMotion ? 0 : index * 0.1,
                  duration: shouldReduceMotion ? 0.18 : 0.72,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <span className={styles.featureNumber}>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className={styles.featureIcon} aria-hidden='true'>
                  {feature.icon}
                </span>

                <div>
                  <small>{feature.label}</small>
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className={styles.tryIt}>
          <div className={styles.tryItCopy}>
            <strong>Want to try Vellira in your own project?</strong>
            <p>
              Explore a complete workspace with project management, forms,
              themes, and platform-specific interactions. Install the
              standalone React or React Native starter and edit the source.
            </p>
          </div>
          <Button asChild appearance='solid' color='primary'>
            <a
              href='https://github.com/vellira-dev/vellira/tree/main/examples/workspace-starter'
              target='_blank'
              rel='noopener noreferrer'
            >
              Try the Workspace Starter
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

PlatformParity.displayName = 'PlatformParity';
