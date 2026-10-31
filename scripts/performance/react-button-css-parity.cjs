// #2014: prepublication, fail-closed CSS Modules class parity audit.
// This is not proof of computed-style equivalence or a public CSS export.
const { gzipSync } = require('node:zlib');

function bytes(source) {
  const raw = Buffer.from(source, 'utf8');
  return {
    raw: raw.length,
    gzipLevel9: gzipSync(raw, { level: 9 }).length,
  };
}

function buttonModuleMap(rootJs) {
  if (typeof rootJs !== 'string') {
    throw new Error('Missing packaged React index.js.');
  }

  const matches = [...rootJs.matchAll(/\bbutton:\s*"(_button_([a-z0-9]{5})_\d+)"/g)];
  const possibilities = [];

  for (const match of matches) {
    const stop = rootJs.indexOf('}', match.index);
    if (stop < 0) continue;
    const source = rootJs.slice(match.index, stop);
    const hash = match[2];
    if (!source.includes('solid: "_solid_' + hash + '_')) continue;
    if (!source.includes('spinner: "_spinner_' + hash + '_')) continue;
    if (!source.includes('loading: "_loading_' + hash + '_')) continue;

    const names = [...source.matchAll(/(?:[\w-]+|"[\w-]+"):\s*"(_[\w-]+_([a-z0-9]{5})_\d+)"/g)]
      .map((entry) => ({ name: entry[1], hash: entry[2] }));
    if (names.length < 10 || names.some((entry) => entry.hash !== hash)) {
      continue;
    }
    possibilities.push({ hash, names: [...new Set(names.map((entry) => entry.name))] });
  }

  if (possibilities.length !== 1) {
    throw new Error(
      'Cannot uniquely identify the published Button CSS module class map.'
    );
  }
  return possibilities[0];
}

function verifyButtonCssParity({ rootJs, fullCss, isolatedCss }) {
  if (typeof fullCss !== 'string' || !fullCss.trim() ||
      typeof isolatedCss !== 'string' || !isolatedCss.trim()) {
    throw new Error('Missing emitted full or isolated Button CSS.');
  }
  const mapped = buttonModuleMap(rootJs);
  const { hash } = mapped;
  const hasSelector = (css, className) => css.includes('.' + className);
  const classNames = mapped.names.filter((name) => !name.startsWith('_button-spin_'));
  if (classNames.length < 10) {
    throw new Error('Button module class map has insufficient selector coverage.');
  }

  for (const name of classNames) {
    if (!hasSelector(fullCss, name)) {
      throw new Error('Published aggregate CSS is missing Button class ' + name);
    }
    if (!hasSelector(isolatedCss, name)) {
      throw new Error('Isolated Button CSS is missing class ' + name);
    }
  }

  const keyframes = mapped.names.filter((name) => name.startsWith('_button-spin_'));
  if (keyframes.length !== 1 ||
      !fullCss.includes('@keyframes ' + keyframes[0]) ||
      !isolatedCss.includes('@keyframes ' + keyframes[0])) {
    throw new Error('Button spinner keyframes are missing or mismatched.');
  }
  const foreignHashes = [
    ...new Set([...isolatedCss.matchAll(/\._[\w-]+_([a-z0-9]{5})_\d+/g)]
      .map((match) => match[1]).filter((foreign) => foreign !== hash)),
  ];
  if (foreignHashes.length > 0) {
    throw new Error('Isolated CSS contains other component module hashes.');
  }
  if (isolatedCss.includes(':root{--space-0:')) {
    throw new Error('Isolated CSS must not silently include the token stylesheet.');
  }

  return {
    schemaVersion: 1,
    state: 'CLASS_PARITY_ONLY',
    buttonModuleHash: hash,
    verifiedSelectorCount: classNames.length,
    verifiedAnimationNames: keyframes,
    publishedAggregate: bytes(fullCss),
    isolatedButtonModule: bytes(isolatedCss),
    limitations: [
      'This compares compiled class/animation identity, not declaration semantics.',
      'No visual, computed-style, Light/Dark/High Contrast, responsive, or a11y proof.',
      'Standalone CSS bytes are not Vite/Next emitted consumer bytes or network transfer.',
      'No new public CSS subpath or supported import has been published.',
    ],
  };
}

module.exports = { buttonModuleMap, verifyButtonCssParity };
