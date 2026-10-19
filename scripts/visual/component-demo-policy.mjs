// Captures only a reviewed, repository-owned Storybook scenario. Arbitrary
// story URLs and external sites are deliberately not supported.
export const STORYBOOK_ORIGIN = 'http://127.0.0.1:6006';

const DEMOS = Object.freeze({
  'tabs-keyboard': Object.freeze({
    storyId: 'components-tabs--controlled',
    title: 'Vellira Tabs — keyboard navigation',
    subtitle: 'Arrow-key activation and live panel updates',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
    phaseFrames: Object.freeze({
      ready: 9,
      profile: 17,
      settings: 17,
      restored: 13,
    }),
    socialStages: Object.freeze([
      Object.freeze({
        name: 'ready',
        label: '01 / HOME',
        key: 'ARROW RIGHT',
        action: 'Navigate to Profile',
      }),
      Object.freeze({
        name: 'profile',
        label: '02 / PROFILE',
        key: 'ARROW RIGHT',
        action: 'Navigate to Settings',
      }),
      Object.freeze({
        name: 'settings',
        label: '03 / SETTINGS',
        key: 'HOME',
        action: 'Return to the first tab',
      }),
      Object.freeze({
        name: 'restored',
        label: '04 / HOME',
        key: 'DONE',
        action: 'Panel and focus restored',
      }),
    ]),
    posterPhase: 'settings',
    maxGifBytes: 8 * 1024 * 1024,
  }),
  'select-keyboard': Object.freeze({
    storyId: 'components-select--simple-usage',
    title: 'Vellira Select — keyboard choice',
    subtitle: 'Keyboard navigation and verified selection',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
    phaseFrames: Object.freeze({
      ready: 9,
      opened: 17,
      highlighted: 17,
      selected: 13,
    }),
    socialStages: Object.freeze([
      Object.freeze({
        name: 'ready',
        label: '01 / READY',
        key: 'ENTER',
        action: 'Open the choices',
      }),
      Object.freeze({
        name: 'opened',
        label: '02 / OPEN',
        key: 'ARROW DOWN',
        action: 'Navigate options',
      }),
      Object.freeze({
        name: 'highlighted',
        label: '03 / HIGHLIGHT',
        key: 'ENTER',
        action: 'Choose Germany',
      }),
      Object.freeze({
        name: 'selected',
        label: '04 / SELECTED',
        key: 'DONE',
        action: 'Germany is selected',
      }),
    ]),
    posterPhase: 'highlighted',
    maxGifBytes: 8 * 1024 * 1024,
  }),
  'modal-focus': Object.freeze({
    storyId: 'components-modal--default',
    title: 'Vellira Modal — focus and Escape dismissal',
    subtitle: 'Keyboard focus and Escape restoration',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
    phaseFrames: Object.freeze({
      ready: 9,
      opened: 17,
      focused: 17,
      closed: 13,
    }),
    socialStages: Object.freeze([
      Object.freeze({
        name: 'ready',
        label: '01 / READY',
        key: 'ENTER',
        action: 'Open the dialog',
      }),
      Object.freeze({
        name: 'opened',
        label: '02 / OPEN',
        key: 'FOCUS',
        action: 'Focus starts inside',
      }),
      Object.freeze({
        name: 'focused',
        label: '03 / NAVIGATE',
        key: 'TAB',
        action: 'Move focus inside',
      }),
      Object.freeze({
        name: 'closed',
        label: '04 / RESTORE',
        key: 'ESC',
        action: 'Return focus to trigger',
      }),
    ]),
    posterPhase: 'opened',
    maxGifBytes: 8 * 1024 * 1024,
  }),
  'button-confirmation': Object.freeze({
    storyId: 'primitives-button--destructive-confirmation',
    title: 'Vellira Button — confirmation and loading',
    subtitle: 'Confirmation and loading feedback',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
    phaseFrames: Object.freeze({
      ready: 9,
      confirming: 17,
      loading: 17,
      closed: 13,
    }),
    socialStages: Object.freeze([
      Object.freeze({
        name: 'ready',
        label: '01 / READY',
        key: 'ENTER',
        action: 'Request confirmation',
      }),
      Object.freeze({
        name: 'confirming',
        label: '02 / CONFIRM',
        key: 'ENTER',
        action: 'Confirm the action',
      }),
      Object.freeze({
        name: 'loading',
        label: '03 / LOADING',
        key: 'BUSY',
        action: 'Show loading feedback',
      }),
      Object.freeze({
        name: 'closed',
        label: '04 / RESET',
        key: 'DONE',
        action: 'Return to ready',
      }),
    ]),
    posterPhase: 'confirming',
    maxGifBytes: 8 * 1024 * 1024,
  }),
  'dropdown-keyboard': Object.freeze({
    storyId: 'components-dropdown--default',
    title: 'Vellira Dropdown — keyboard navigation and Escape',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
    // These are screenshots of real browser states taken ONLY after the story,
    // fonts and component have rendered; no navigation/loading footage exists.
    phaseFrames: Object.freeze({ ready: 9, opened: 17, highlighted: 17, closed: 13 }),
    maxGifBytes: 8 * 1024 * 1024,
  }),
});

export function getDemo(name) {
  if (!Object.hasOwn(DEMOS, name)) {
    throw new Error(`Unknown component demo: ${JSON.stringify(name)}`);
  }
  return DEMOS[name];
}

export function getStoryUrl(name) {
  const { storyId } = getDemo(name);
  return `${STORYBOOK_ORIGIN}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&globals=theme:light`;
}

export function getFrameCount(demo) {
  const counts = Object.values(demo.phaseFrames);
  if (counts.length !== 4 || counts.some((n) => !Number.isSafeInteger(n) || n <= 0)) {
    throw new Error('Invalid reviewed demo frame plan.');
  }
  return counts.reduce((a, b) => a + b, 0);
}

export function verifyRevision(actual, expected) {
  if (!/^[0-9a-f]{40}$/.test(actual)) {
    throw new Error('Capture must be bound to an exact Git commit SHA.');
  }
  if (expected !== undefined && actual !== expected) {
    throw new Error('Capture revision does not match the dispatched GitHub SHA.');
  }
}

export function verifyGifSize(size, limit) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > limit) {
    throw new Error(`GIF must be nonempty and no larger than ${limit} bytes (got ${size}).`);
  }
}

export function verifyDuration(duration, demo) {
  const expected = getFrameCount(demo) / demo.gifFps;
  if (!Number.isFinite(duration) || Math.abs(duration - expected) > 0.35) {
    throw new Error(`Unexpected encoded video duration: ${duration} (expected ${expected}).`);
  }
}
