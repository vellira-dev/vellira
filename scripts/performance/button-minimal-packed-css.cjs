// #2014: construct a TEMPORARY, unsupported Button-only CSS fixture from
// one exact, packed Vellira candidate. Never publish this as a package export.
// Fail closed if the compiler moves the reset or token CSS boundaries.
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { buttonModuleMap } = require('./react-button-css-parity.cjs');

const RESET = '*,:before,:after{box-sizing:border-box}';
const TOKENS = ':root{--space-0:';
const FOOTER = /(?:\r?\n)?\/\*\$vite\$:\d+\*\/\s*$/;

function sizes(data) {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  return { rawBytes: b.length, gzipBytes: gzipSync(b, { level: 9 }).length };
}

function uniqueOffset(buffer, marker, label) {
  const first = buffer.indexOf(marker);
  if (first < 0 || buffer.indexOf(marker, first + marker.length) !== -1) {
    throw new Error('Packed CSS lacks one unambiguous ' + label + ' boundary.');
  }
  return first;
}

function buildTemporaryButtonCss({ fullCss, rootJs, parity, candidateSha, candidateVersion }) {
  if (!Buffer.isBuffer(fullCss) || fullCss.length < 1000 ||
      typeof rootJs !== 'string' || !parity ||
      !/^[a-f0-9]{40}$/.test(candidateSha ?? '') ||
      typeof candidateVersion !== 'string' ||
      parity.sourceSha !== candidateSha ||
      parity.candidateVersion !== candidateVersion ||
      parity.state !== 'CLASS_PARITY_ONLY' ||
      parity.embeddedBlock?.state !== 'BYTE_IDENTICAL_COMPILED_BLOCK') {
    throw new Error('Missing exact packed Button CSS provenance.');
  }

  const { byteOffset, rawBytes, sha256 } = parity.embeddedBlock;
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 ||
      !Number.isSafeInteger(rawBytes) || rawBytes < 100 ||
      byteOffset + rawBytes > fullCss.length ||
      !/^[a-f0-9]{64}$/.test(sha256 ?? '')) {
    throw new Error('Invalid byte-bound Button CSS evidence.');
  }
  const block = fullCss.subarray(byteOffset, byteOffset + rawBytes);
  const digest = createHash('sha256').update(block).digest('hex');
  if (digest !== sha256) {
    throw new Error('Packed Button CSS block differs from immutable proof.');
  }
  const mapped = buttonModuleMap(rootJs);
  if (mapped.hash !== parity.buttonModuleHash ||
      mapped.names.filter((name) => !name.startsWith('_button-spin_')).length !==
        parity.verifiedSelectorCount) {
    throw new Error('Packed JS Button CSS Modules map differs from proof.');
  }

  const resetStart = uniqueOffset(fullCss, Buffer.from(RESET), 'global reset');
  const tokensStart = uniqueOffset(fullCss, Buffer.from(TOKENS), 'token root');
  if (resetStart <= byteOffset + rawBytes || tokensStart <= resetStart) {
    throw new Error('CSS module, global reset and token order has changed.');
  }
  const trailing = fullCss.toString('utf8').match(FOOTER);
  if (!trailing) {
    throw new Error('Packed stylesheet has an unknown Vite footer.');
  }
  const bodyEnd = fullCss.length - Buffer.byteLength(trailing[0]);
  if (bodyEnd <= tokensStart) {
    throw new Error('Missing token stylesheet tail.');
  }
  const tail = fullCss.subarray(resetStart, bodyEnd);
  const global = fullCss.subarray(resetStart, tokensStart).toString('utf8');
  if (!global.includes('html,body{margin:0;padding:0}') ||
      !global.includes('button{color:inherit') ||
      !global.includes('body{color:var(--text-primary)')) {
    throw new Error('Minimal candidate cannot prove global reset/base ownership.');
  }
  if (/\._[\w-]+_[a-z0-9]{5}_\d+/.test(tail.toString('utf8'))) {
    throw new Error('Token/reset tail contains another scoped component.');
  }
  const minimal = Buffer.concat([block, tail]);
  const css = minimal.toString('utf8');
  for (const className of mapped.names) {
    if (className.startsWith('_button-spin_')) {
      if (!css.includes('@keyframes ' + className)) {
        throw new Error('Minimal CSS lost Button spinner keyframes.');
      }
    } else if (!css.includes('.' + className)) {
      throw new Error('Minimal CSS lost Button class ' + className);
    }
  }
  const fullSize = sizes(fullCss);
  const reducedSize = sizes(minimal);
  if (reducedSize.rawBytes >= fullSize.rawBytes ||
      reducedSize.gzipBytes >= fullSize.gzipBytes) {
    throw new Error('Temporary Button CSS has no measurable size reduction.');
  }

  return {
    css,
    evidence: {
      status: 'UNPUBLISHED_PACKED_CONSUMER_FIXTURE',
      candidateSha,
      candidateVersion,
      buttonHash: mapped.hash,
      selectorCount: parity.verifiedSelectorCount,
      blockSha256: sha256,
      globalResetOffset: resetStart,
      tokenRootOffset: tokensStart,
      fullStyles: fullSize,
      buttonFixture: reducedSize,
      cssDifference: {
        rawBytes: fullSize.rawBytes - reducedSize.rawBytes,
        gzipBytes: fullSize.gzipBytes - reducedSize.gzipBytes,
      },
      limitations: [
        'Temporary fixture only. The npm package does not export these reduced styles.',
        'Source stylesheet sizes are not emitted Vite/Next app assets or network transfer.',
        'Browser computed-style, visual, theme and interaction parity must pass independently.',
      ],
    },
  };
}

module.exports = { buildTemporaryButtonCss };
