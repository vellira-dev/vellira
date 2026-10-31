// #2014: prepublication, fail-closed CSS Modules class parity audit.
// This is not proof of computed-style equivalence or a public CSS export.
const { createHash } = require('node:crypto');
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

// The isolated library build appends a Vite provenance footer. Only that
// known footer is ignored; do not normalize CSS, selectors, declaration
// order, media queries or whitespace into false equivalence.
function verifyEmbeddedButtonBlock(fullCss, isolatedCss, hash) {
  const body = isolatedCss.replace(/(?:\r?\n)?\/\*\$vite\$:\d+\*\/\s*$/, '');
  if (body.length < 100) {
    throw new Error('Compiled isolated Button CSS is unexpectedly empty.');
  }

  const index = fullCss.indexOf(body);
  if (index === -1) {
    throw new Error(
      'Isolated Button CSS rule bytes are not identical to a contiguous ' +
        'block in published aggregate CSS.'
    );
  }
  if (fullCss.indexOf(body, index + body.length) !== -1) {
    throw new Error('Published aggregate CSS has duplicate Button blocks.');
  }

  // The published stylesheet must not refer to this scoped Button hash
  // outside the one proven byte-identical block.
  const names = new RegExp('_[\\w-]+_' + hash + '_\\d+', 'g');
  for (const match of fullCss.matchAll(names)) {
    if (match.index < index || match.index >= index + body.length) {
      throw new Error('Published Button module CSS escapes its matched block.');
    }
  }
  return {
    state: 'BYTE_IDENTICAL_COMPILED_BLOCK',
    byteOffset: Buffer.byteLength(fullCss.slice(0, index)),
    rawBytes: Buffer.byteLength(body),
    sha256: createHash('sha256').update(body).digest('hex'),
    trailingViteFooterExcluded: body !== isolatedCss,
  };
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
    embeddedBlock: verifyEmbeddedButtonBlock(fullCss, isolatedCss, hash),
    limitations: [
      'The isolated compiled Button block is byte-identical inside the aggregate CSS; this does not prove global reset/cascade or computed-style parity.',
      'No visual, computed-style, Light/Dark/High Contrast, responsive, or a11y proof.',
      'Standalone CSS bytes are not Vite/Next emitted consumer bytes or network transfer.',
      'No new public CSS subpath or supported import has been published.',
    ],
  };
}

module.exports = { buttonModuleMap, verifyEmbeddedButtonBlock, verifyButtonCssParity };
