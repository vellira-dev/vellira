// #2014: validate a complete, same-candidate browser parity matrix.
// Fail closed on missing engines, pages, states, computed styles or screenshots.
const ENGINES = Object.freeze(['chromium', 'firefox', 'webkit']);
const SURFACES = Object.freeze(['viteBrowser', 'nextBrowser']);
const WIDTHS = Object.freeze([1180, 390]);
const THEMES = Object.freeze(['light', 'dark', 'highContrast']);

function expectedKeys() {
  return WIDTHS.flatMap((width) => [
    ...THEMES.map((theme) => width + '-' + theme),
    width + '-hover',
    width + '-keyboard',
  ]);
}

function assertCompleteButtonBrowserParity(variants) {
  if (!variants || typeof variants !== 'object' ||
      !variants.full || !variants.minimal) {
    throw new Error('Browser proof needs both packed full and Button-only consumers.');
  }
  const keys = expectedKeys();
  for (const surface of SURFACES) {
    for (const engine of ENGINES) {
      const full = variants.full[surface]?.[engine];
      const reduced = variants.minimal[surface]?.[engine];
      if (!full || !reduced) {
        throw new Error('Missing ' + surface + ' ' + engine + ' browser proof.');
      }
      for (const [version, snapshots] of [['full', full], ['minimal', reduced]]) {
        if (JSON.stringify(Object.keys(snapshots).sort()) !==
            JSON.stringify([...keys].sort())) {
          throw new Error(
            surface + ' ' + engine + ' ' + version + ' lacks required browser states.'
          );
        }
        for (const key of keys) {
          const frame = snapshots[key];
          if (!frame || typeof frame !== 'object' ||
              !frame.computed || typeof frame.computed !== 'object') {
            throw new Error(
              surface + ' ' + engine + ' ' + version + ' lacks ' + key + ' computed styles.'
            );
          }
          if (!key.endsWith('-hover') &&
              !/^[a-f0-9]{64}$/.test(frame.screenshotSha256 ?? '')) {
            throw new Error(
              surface + ' ' + engine + ' ' + version + ' lacks ' + key + ' screenshot.'
            );
          }
          if (key.endsWith('-keyboard')) {
            const info = frame.computed;
            if (info.focused !== true || info.focusVisible !== true ||
                info.activations !== 2 || info.nativeDisabled !== true ||
                info.loadingDisabled !== true || info.loadingBusy !== true ||
                info.iconLabel !== 'Add') {
              throw new Error(
                surface + ' ' + engine + ' ' + version +
                ' has invalid keyboard or accessibility semantics.'
              );
            }
          } else if (!key.endsWith('-hover') &&
                     frame.computed.buttonCount !== 10) {
            throw new Error(
              surface + ' ' + engine + ' ' + version + ' lacks all 10 Button cases.'
            );
          }
        }
      }
      if (JSON.stringify(full) !== JSON.stringify(reduced)) {
        const first = keys.find((key) =>
          JSON.stringify(full[key]) !== JSON.stringify(reduced[key])
        );
        throw new Error(
          surface + ' ' + engine + ' full/optimized computed styles or ' +
          'screenshots differ at ' + String(first ?? 'unknown state') + '.'
        );
      }
    }
  }

  return {
    state: 'COMPLETE_PACKED_VITE_NEXT_CROSS_BROWSER_PARITY',
    targets: [...SURFACES],
    engines: [...ENGINES],
    viewportWidths: [...WIDTHS],
    themes: [...THEMES],
    comparedStatePairs: SURFACES.length * ENGINES.length * keys.length,
    keyboardPairs: SURFACES.length * ENGINES.length * WIDTHS.length,
  };
}

module.exports = {
  ENGINES,
  SURFACES,
  WIDTHS,
  THEMES,
  expectedKeys,
  assertCompleteButtonBrowserParity,
};
