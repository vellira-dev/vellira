// Captures only a reviewed, repository-owned Storybook scenario. Arbitrary
// story URLs and external sites are deliberately not supported.
export const STORYBOOK_ORIGIN = 'http://127.0.0.1:6006';

const DEMOS = Object.freeze({
  'dropdown-keyboard': Object.freeze({
    storyId: 'components-dropdown--default',
    title: 'Vellira Dropdown — keyboard navigation and Escape',
    viewport: Object.freeze({ width: 960, height: 540 }),
    gifWidth: 800,
    gifFps: 12,
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
