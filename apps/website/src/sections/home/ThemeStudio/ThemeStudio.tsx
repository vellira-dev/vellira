'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Button,
  Checkbox,
  Dropdown,
  FormField,
  Input,
  Tabs,
  ThemeProvider,
  Tooltip,
} from '@vellira-ui/react';
import { Check } from '@vellira-ui/icons';
import { motion, useReducedMotion } from 'motion/react';

import styles from './ThemeStudio.module.css';

type ThemeMode = 'light' | 'dark' | 'highContrast';
type AccentName = 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
type RadiusName = 'sm' | 'md' | 'lg' | 'xl';
type DensityName = 'comfort' | 'compact';
type TokenControl = 'color' | 'radius' | 'theme' | 'density';
type PreviewTheme = 'light' | 'dark' | 'high-contrast';
type TokenSnapshot = {
  accent: AccentName;
  radius: RadiusName;
  themeMode: ThemeMode;
};

const accentOptions: Array<{
  value: AccentName;
  label: string;
}> = [
  { value: 'primary', label: 'Primary' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
];

const radiusOptions: Array<{
  value: RadiusName;
  label: string;
}> = [
  { value: 'sm', label: '8' },
  { value: 'md', label: '12' },
  { value: 'lg', label: '16' },
  { value: 'xl', label: '24' },
];

const themeOptions: Array<{
  value: ThemeMode;
  label: string;
}> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'highContrast', label: 'High Contrast' },
];

const densityOptions: Array<{
  value: DensityName;
  label: string;
}> = [
  { value: 'comfort', label: 'Comfort' },
  { value: 'compact', label: 'Compact' },
];

const tokenProofs = [
  'Semantic tokens',
  'CSS Variables',
  'React Native themes',
  'Zero hardcoded colors',
] as const;

const AUTO_DEMO_INTERVAL = 5200;
const INTERACTION_PAUSE = 12000;

const getPreviewTheme = (theme: ThemeMode): PreviewTheme =>
  theme === 'highContrast' ? 'high-contrast' : theme;

const getOptionLabel = <T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T
) => options.find((option) => option.value === value)?.label ?? value;

export function ThemeStudio() {
  const shouldReduceMotion = useReducedMotion();

  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState<AccentName>('primary');
  const [radius, setRadius] = useState<RadiusName>('lg');
  const [density, setDensity] = useState<DensityName>('comfort');
  const [highlightedToken, setHighlightedToken] = useState<TokenControl | null>(
    null
  );
  const [previousTokens, setPreviousTokens] = useState<TokenSnapshot>({
    accent: 'primary',
    radius: 'lg',
    themeMode: 'light',
  });
  const [workspace, setWorkspace] = useState('Vellira workspace');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const demoStepRef = useRef(0);
  const pauseUntilRef = useRef(0);

  const pauseAutomation = () => {
    pauseUntilRef.current = Date.now() + INTERACTION_PAUSE;
  };
  const previewTheme = getPreviewTheme(themeMode);
  const accentLabel = getOptionLabel(accentOptions, accent);
  const previousAccentLabel = getOptionLabel(
    accentOptions,
    previousTokens.accent
  );
  const radiusLabel = getOptionLabel(radiusOptions, radius);
  const previousRadiusLabel = getOptionLabel(
    radiusOptions,
    previousTokens.radius
  );
  const themeLabel = getOptionLabel(themeOptions, themeMode);
  const previousThemeLabel = getOptionLabel(
    themeOptions,
    previousTokens.themeMode
  );
  const hasTokenChange =
    previousTokens.accent !== accent ||
    previousTokens.radius !== radius ||
    previousTokens.themeMode !== themeMode;
  const tokenRows = [
    {
      name: 'intent.primary',
      value: accentLabel,
      target: 'Button · Tabs · Checkbox · Input',
      type: 'color',
    },
    {
      name: 'radius.surface',
      value: `${radiusLabel}px`,
      target: 'Cards · Inputs · Menus',
      type: 'radius',
    },
    {
      name: 'theme.mode',
      value: themeLabel,
      target: 'Surface · Text · Borders',
      type: 'theme',
    },
    {
      name: 'density.layout',
      value: density,
      target: 'Padding · Gaps · Rhythm',
      type: 'density',
    },
  ] as const;

  useEffect(() => {
    if (shouldReduceMotion) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) {
        return;
      }

      const step = demoStepRef.current % 4;
      demoStepRef.current += 1;

      if (step === 0) {
        setHighlightedToken('color');
        setAccent((currentAccent) => {
          setPreviousTokens((currentTokens) => ({
            ...currentTokens,
            accent: currentAccent,
          }));
          return currentAccent === 'primary' ? 'success' : 'primary';
        });
      }

      if (step === 1) {
        setHighlightedToken('radius');
        setRadius((currentRadius) => {
          setPreviousTokens((currentTokens) => ({
            ...currentTokens,
            radius: currentRadius,
          }));
          return currentRadius === 'lg' ? 'xl' : 'lg';
        });
      }

      if (step === 2) {
        setHighlightedToken('theme');
        setThemeMode((currentTheme) => {
          setPreviousTokens((currentTokens) => ({
            ...currentTokens,
            themeMode: currentTheme,
          }));
          return currentTheme === 'light' ? 'dark' : 'light';
        });
      }

      if (step === 3) {
        setHighlightedToken('density');
        setDensity((currentDensity) =>
          currentDensity === 'comfort' ? 'compact' : 'comfort'
        );
      }

      window.setTimeout(() => {
        if (Date.now() >= pauseUntilRef.current) {
          setHighlightedToken(null);
        }
      }, 1400);
    }, AUTO_DEMO_INTERVAL);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [shouldReduceMotion]);

  return (
    <section
      id='themes'
      className={styles.section}
      aria-labelledby='theme-studio-title'
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
          <span className={styles.eyebrow}>Design tokens</span>

          <h2 id='theme-studio-title' className={styles.title}>
            Design once.
            <span>Theme everywhere.</span>
          </h2>

          <p className={styles.description}>
            Every semantic token updates React and React Native at the same
            time.
          </p>
        </motion.header>

        <motion.div
          className={styles.studio}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 64, scale: 0.97 }
          }
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: shouldReduceMotion ? 0 : 0.08,
            duration: shouldReduceMotion ? 0.2 : 0.95,
            ease: [0.16, 1, 0.3, 1],
          }}
          viewport={{ once: true, amount: 0.16 }}
        >
          <motion.aside
            className={styles.controls}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: -42, filter: 'blur(8px)' }
            }
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.18,
              duration: shouldReduceMotion ? 0.16 : 0.68,
              ease: [0.16, 1, 0.3, 1],
            }}
            viewport={{ once: true, amount: 0.24 }}
          >
            <div className={styles.panelHeader}>
              <div>
                <span className={styles.panelEyebrow}>Token studio</span>
                <h3>Semantic tokens</h3>
              </div>

              <span className={styles.liveBadge}>
                <span aria-hidden='true' />
                Live
              </span>
            </div>

            <div className={styles.controlSections}>
              <div
                className={styles.controlGroup}
                onMouseEnter={() => {
                  setHighlightedToken('color');
                }}
                onMouseLeave={() => {
                  setHighlightedToken(null);
                }}
              >
                <div className={styles.controlHeading}>
                  <span>Color intent</span>
                  <code>{accent}</code>
                </div>

                <div className={styles.optionGrid}>
                  {accentOptions.map((option) => (
                    <Button
                      key={option.value}
                      type='button'
                      appearance='outline'
                      color={accent === option.value ? option.value : 'neutral'}
                      size='sm'
                      shape='rounded'
                      fullWidth
                      aria-pressed={accent === option.value}
                      data-accent={option.value}
                      className={
                        accent === option.value
                          ? styles.activeOption
                          : styles.option
                      }
                      iconStart={
                        <span
                          className={styles.colorSwatch}
                          data-accent={option.value}
                          aria-hidden='true'
                        />
                      }
                      onClick={() => {
                        pauseAutomation();
                        setHighlightedToken('color');
                        setPreviousTokens((currentTokens) => ({
                          ...currentTokens,
                          accent,
                        }));
                        setAccent(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div
                className={styles.controlGroup}
                onMouseEnter={() => {
                  setHighlightedToken('radius');
                }}
                onMouseLeave={() => {
                  setHighlightedToken(null);
                }}
              >
                <div className={styles.controlHeading}>
                  <span>Radius</span>
                  <code>
                    {radiusOptions.find((item) => item.value === radius)?.label}
                    px
                  </code>
                </div>

                <div className={styles.radiusPicker}>
                  {radiusOptions.map((option) => (
                    <Button
                      key={option.value}
                      type='button'
                      appearance='outline'
                      color={radius === option.value ? 'primary' : 'neutral'}
                      size='sm'
                      shape='rounded'
                      fullWidth
                      aria-pressed={radius === option.value}
                      className={
                        radius === option.value
                          ? styles.activeRadius
                          : styles.radiusOption
                      }
                      onClick={() => {
                        pauseAutomation();
                        setHighlightedToken('radius');
                        setPreviousTokens((currentTokens) => ({
                          ...currentTokens,
                          radius,
                        }));
                        setRadius(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div
                className={styles.controlGroup}
                onMouseEnter={() => {
                  setHighlightedToken('theme');
                }}
                onMouseLeave={() => {
                  setHighlightedToken(null);
                }}
              >
                <div className={styles.controlHeading}>
                  <span>Theme</span>
                  <code>{themeMode}</code>
                </div>

                <div className={styles.segmentedControl}>
                  {themeOptions.map((option) => (
                    <Button
                      key={option.value}
                      type='button'
                      appearance='outline'
                      color={themeMode === option.value ? 'primary' : 'neutral'}
                      size='sm'
                      shape='rounded'
                      fullWidth
                      aria-pressed={themeMode === option.value}
                      className={
                        themeMode === option.value
                          ? styles.activeSegment
                          : styles.segment
                      }
                      onClick={() => {
                        pauseAutomation();
                        setHighlightedToken('theme');
                        setPreviousTokens((currentTokens) => ({
                          ...currentTokens,
                          themeMode,
                        }));
                        setThemeMode(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div
                className={styles.controlGroup}
                onMouseEnter={() => {
                  setHighlightedToken('density');
                }}
                onMouseLeave={() => {
                  setHighlightedToken(null);
                }}
              >
                <div className={styles.controlHeading}>
                  <span>Density</span>
                  <code>{density}</code>
                </div>

                <div className={styles.segmentedControl}>
                  {densityOptions.map((option) => (
                    <Button
                      key={option.value}
                      type='button'
                      appearance='outline'
                      color={density === option.value ? 'primary' : 'neutral'}
                      size='sm'
                      shape='rounded'
                      fullWidth
                      aria-pressed={density === option.value}
                      className={
                        density === option.value
                          ? styles.activeSegment
                          : styles.segment
                      }
                      onClick={() => {
                        pauseAutomation();
                        setHighlightedToken('density');
                        setDensity(option.value);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>

          <span
            className={styles.connector}
            data-flow={highlightedToken ?? undefined}
            data-accent={accent}
            aria-hidden='true'
          >
            <span />
          </span>

          <motion.div
            className={styles.preview}
            data-highlight={highlightedToken ?? undefined}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, x: 42, filter: 'blur(8px)' }
            }
            whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            transition={{
              delay: shouldReduceMotion ? 0 : 0.28,
              duration: shouldReduceMotion ? 0.16 : 0.68,
              ease: [0.16, 1, 0.3, 1],
            }}
            viewport={{ once: true, amount: 0.24 }}
          >
            <ThemeProvider theme={previewTheme} syncDocument={false}>
              <div
                className={styles.themeFrame}
                data-accent={accent}
                data-radius={radius}
                data-density={density}
              >
                <div className={styles.previewHeader}>
                  <div>
                    <span className={styles.panelEyebrow}>
                      Live application
                    </span>
                    <h3>Rendered UI</h3>
                  </div>

                  <div className={styles.syncStatus}>
                    <span>
                      <span aria-hidden='true' />
                      Shared tokens
                    </span>
                    <strong>React · React Native</strong>
                  </div>
                </div>

                <div className={styles.previewSurface}>
                  <div className={styles.appToolbar}>
                    <div>
                      <span className={styles.appEyebrow}>Workspace</span>
                      <strong>{workspace}</strong>
                    </div>

                    <div className={styles.appActions}>
                      <Tooltip placement='top' portal={false}>
                        <Tooltip.Trigger asChild>
                          <Button
                            appearance='soft'
                            color='primary'
                            className={styles.tokenizedButton}
                          >
                            Tokens
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content withArrow>
                          Semantic tokens drive focus, color, radius, and
                          density.
                        </Tooltip.Content>
                      </Tooltip>

                      <Dropdown
                        placement='bottom-end'
                        color={accent}
                        portal={false}
                      >
                        <Dropdown.Trigger asChild>
                          <Button
                            appearance='outline'
                            color={accent}
                            className={styles.tokenizedButton}
                          >
                            Actions
                          </Button>
                        </Dropdown.Trigger>

                        <Dropdown.Content>
                          <Dropdown.Item
                            color={accent === 'neutral' ? 'default' : accent}
                          >
                            Edit workspace
                          </Dropdown.Item>
                          <Dropdown.Item>Duplicate workspace</Dropdown.Item>
                          <Dropdown.Separator />
                          <Dropdown.Item color='danger'>
                            Delete workspace
                          </Dropdown.Item>
                        </Dropdown.Content>
                      </Dropdown>
                    </div>
                  </div>

                  <Tabs
                    value={activeTab}
                    onValueChange={(value) => {
                      pauseAutomation();
                      setActiveTab(value);
                    }}
                    variant='segmented'
                    color='primary'
                  >
                    <Tabs.List>
                      <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
                      <Tabs.Trigger value='changes'>Changes</Tabs.Trigger>
                      <Tabs.Trigger value='tokens'>Tokens</Tabs.Trigger>
                      <Tabs.Indicator />
                    </Tabs.List>

                    <Tabs.Content value='overview'>
                      <div className={styles.previewContent}>
                        <div className={styles.formCard}>
                          <FormField
                            label='Workspace name'
                            description='Visible to everyone in your workspace.'
                          >
                            <Input
                              color='primary'
                              value={workspace}
                              onValueChange={(value) => {
                                pauseAutomation();
                                setWorkspace(value);
                              }}
                            />
                          </FormField>

                          <Checkbox
                            color='primary'
                            label='Enable notifications'
                            description='Receive workspace and release updates.'
                            checked={notificationsEnabled}
                            onCheckedChange={(checked) => {
                              pauseAutomation();
                              setNotificationsEnabled(checked);
                            }}
                          />

                          <Button
                            fullWidth
                            color='primary'
                            className={styles.tokenizedButton}
                          >
                            Save changes
                          </Button>
                        </div>

                        <div className={styles.statsGrid}>
                          <article data-change='color'>
                            <span>Components</span>
                            <strong>42</strong>
                          </article>

                          <article data-change='radius'>
                            <span>Coverage</span>
                            <strong>98%</strong>
                          </article>

                          <article data-change='theme'>
                            <span>Themes</span>
                            <strong>3</strong>
                          </article>
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value='changes'>
                      <div className={styles.changeConsole}>
                        <div className={styles.consoleHeader}>
                          <span>
                            {hasTokenChange
                              ? 'Applied changes'
                              : 'Current state'}
                          </span>
                          <code>Updated just now</code>
                        </div>

                        <div
                          key={`${accent}-${radius}-${themeMode}`}
                          className={styles.changeList}
                        >
                          <article>
                            <span
                              className={styles.checkIcon}
                              aria-hidden='true'
                            >
                              <Check size={13} />
                            </span>
                            <div>
                              <strong>Color intent</strong>
                              <p className={styles.intentChange}>
                                <span
                                  className={styles.colorSwatch}
                                  data-accent={previousTokens.accent}
                                  aria-hidden='true'
                                />
                                {hasTokenChange
                                  ? previousAccentLabel
                                  : accentLabel}
                                {hasTokenChange ? ' → ' : null}
                                {hasTokenChange ? (
                                  <>
                                    <span
                                      className={styles.colorSwatch}
                                      data-accent={accent}
                                      aria-hidden='true'
                                    />
                                    {accentLabel}
                                  </>
                                ) : null}
                              </p>
                              <small>Updated 18 component states</small>
                            </div>
                          </article>

                          <article>
                            <span
                              className={styles.checkIcon}
                              aria-hidden='true'
                            >
                              <Check size={13} />
                            </span>
                            <div>
                              <strong>Radius</strong>
                              <p>
                                {hasTokenChange
                                  ? `${previousRadiusLabel}px → `
                                  : null}
                                {radiusLabel}px
                              </p>
                              <small>Updated 42 surfaces</small>
                            </div>
                          </article>

                          <article>
                            <span
                              className={styles.checkIcon}
                              aria-hidden='true'
                            >
                              <Check size={13} />
                            </span>
                            <div>
                              <strong>Theme</strong>
                              <p>
                                {hasTokenChange
                                  ? `${previousThemeLabel} → `
                                  : null}
                                {themeLabel}
                              </p>
                              <small>CSS variables regenerated</small>
                            </div>
                          </article>
                        </div>

                        <div className={styles.syncGrid}>
                          <span>
                            <Check size={12} aria-hidden='true' />
                            React
                          </span>
                          <span>
                            <Check size={12} aria-hidden='true' />
                            React Native
                          </span>
                          <span>
                            <Check size={12} aria-hidden='true' />
                            CSS Variables
                          </span>
                        </div>
                      </div>
                    </Tabs.Content>

                    <Tabs.Content value='tokens'>
                      <div className={styles.tokenInspector}>
                        <div className={styles.tokenInspectorHeader}>
                          <span>Semantic token map</span>
                          <code>{previewTheme}</code>
                        </div>

                        <div className={styles.tokenRows}>
                          {tokenRows.map((token) => (
                            <article key={token.name} data-token={token.type}>
                              <span
                                className={styles.tokenMarker}
                                data-accent={accent}
                                aria-hidden='true'
                              />

                              <div>
                                <strong>{token.name}</strong>
                                <small>{token.target}</small>
                              </div>

                              <code>{token.value}</code>
                            </article>
                          ))}
                        </div>

                        <div className={styles.outputGrid}>
                          <span>CSS vars</span>
                          <strong>128</strong>
                          <span>Web states</span>
                          <strong>18</strong>
                          <span>Native aliases</span>
                          <strong>42</strong>
                        </div>
                      </div>
                    </Tabs.Content>
                  </Tabs>
                </div>
              </div>
            </ThemeProvider>
          </motion.div>
        </motion.div>

        <ul className={styles.proofs} aria-label='Token system features'>
          {tokenProofs.map((proof) => (
            <li key={proof}>
              <Check size={13} aria-hidden='true' />
              {proof}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

ThemeStudio.displayName = 'ThemeStudio';
