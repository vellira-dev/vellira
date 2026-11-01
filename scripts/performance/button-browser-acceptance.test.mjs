import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  ENGINES,
  SURFACES,
  expectedKeys,
  assertCompleteButtonBrowserParity,
} = require('./button-browser-acceptance.cjs');

const hash = 'a'.repeat(64);

function fixture() {
  const result = { full: {}, minimal: {} };
  for (const variant of ['full', 'minimal']) {
    for (const target of SURFACES) {
      result[variant][target] = {};
      for (const engine of ENGINES) {
        result[variant][target][engine] = Object.fromEntries(
          expectedKeys().map((key) => [
            key,
            key.endsWith('-hover')
              ? { computed: ['rgb(1,2,3)', 'rgb(4,5,6)', 'none'] }
              : key.endsWith('-keyboard')
                ? {
                    computed: {
                      focused: true,
                      focusVisible: true,
                      activations: 2,
                      nativeDisabled: true,
                      loadingDisabled: true,
                      loadingBusy: true,
                      iconLabel: 'Add',
                    },
                    screenshotSha256: hash,
                  }
                : {
                    computed: { buttonCount: 10, cases: { solid: {} } },
                    screenshotSha256: hash,
                  },
          ])
        );
      }
    }
  }
  return result;
}

test('accepts complete Vite and Next production browser proof for three engines', () => {
  const result = assertCompleteButtonBrowserParity(fixture());
  assert.equal(result.state, 'COMPLETE_PACKED_VITE_NEXT_CROSS_BROWSER_PARITY');
  assert.deepEqual(result.engines, ['chromium', 'firefox', 'webkit']);
  assert.deepEqual(result.targets, ['viteBrowser', 'nextBrowser']);
  assert.equal(result.comparedStatePairs, 60);
  assert.equal(result.keyboardPairs, 12);
});

test('rejects missing engine or missing Next.js browser evidence', () => {
  const missingEngine = fixture();
  delete missingEngine.minimal.viteBrowser.webkit;
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingEngine),
    /Missing viteBrowser webkit browser proof/
  );

  const missingNext = fixture();
  delete missingNext.full.nextBrowser;
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingNext),
    /Missing nextBrowser chromium browser proof/
  );
});

test('rejects missing snapshot, computed styles and screenshots', () => {
  const missingFrame = fixture();
  delete missingFrame.minimal.nextBrowser.firefox['390-dark'];
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingFrame),
    /lacks required browser states/
  );

  const missingStyles = fixture();
  delete missingStyles.full.viteBrowser.chromium['1180-light'].computed;
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingStyles),
    /lacks 1180-light computed styles/
  );

  const missingScreenshot = fixture();
  delete missingScreenshot.full.nextBrowser.webkit['390-keyboard'].screenshotSha256;
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingScreenshot),
    /lacks 390-keyboard screenshot/
  );
});

test('rejects cosmetic mismatches instead of accepting only CSS byte reduction', () => {
  const mismatch = fixture();
  mismatch.minimal.nextBrowser.firefox['1180-dark'].screenshotSha256 =
    'b'.repeat(64);
  assert.throws(
    () => assertCompleteButtonBrowserParity(mismatch),
    /nextBrowser firefox full\/optimized computed styles or screenshots differ/
  );

  const invalidSemantics = fixture();
  invalidSemantics.full.viteBrowser.webkit['390-keyboard'].computed.activations = 1;
  assert.throws(
    () => assertCompleteButtonBrowserParity(invalidSemantics),
    /invalid keyboard or accessibility semantics/
  );

  const missingButton = fixture();
  missingButton.full.viteBrowser.firefox['1180-light'].computed.buttonCount = 9;
  assert.throws(
    () => assertCompleteButtonBrowserParity(missingButton),
    /lacks all 10 Button cases/
  );
});
