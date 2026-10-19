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
