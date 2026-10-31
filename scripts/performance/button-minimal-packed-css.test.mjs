import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { buildTemporaryButtonCss } = require('./button-minimal-packed-css.cjs');

const candidateSha = 'a'.repeat(40);
const candidateVersion = '2.188.11';
const names = [
  'button', 'solid', 'spinner', 'loading', 'primary', 'neutral', 'disabled',
  'pill', 'rounded', 'sm', 'md', 'lg', 'badge', 'icon',
];
const mapped = '{' + names.map((name) =>
  name + ': "_' + name + '_abcde_1"'
).join(',') + ',"button-spin":"_button-spin_abcde_1"}';
const buttonCss = names.map((name) =>
  '._' + name + '_abcde_1{display:flex;color:var(--text-primary)}'
).join('') + '@keyframes _button-spin_abcde_1{to{transform:rotate(360deg)}}';
const other = '._accordion_xyzab_1{background:red;}'.repeat(120);
const global = '*,:before,:after{box-sizing:border-box}' +
  'html,body{margin:0;padding:0}' +
  'button{color:inherit;cursor:pointer}' +
  'body{color:var(--text-primary)}';
const tokens = ':root{--space-0:0px;--text-primary:#123456}' +
  '[data-vellira-theme=dark]{--text-primary:#abcdef}'.repeat(140);
const fullCss = Buffer.from(other + buttonCss + other + global + tokens + '\n/*$vite$:1*/');
const proof = {
  sourceSha: candidateSha,
  candidateVersion,
  state: 'CLASS_PARITY_ONLY',
  buttonModuleHash: 'abcde',
  verifiedSelectorCount: names.length,
  embeddedBlock: {
    state: 'BYTE_IDENTICAL_COMPILED_BLOCK',
    byteOffset: Buffer.byteLength(other),
    rawBytes: Buffer.byteLength(buttonCss),
    sha256: createHash('sha256').update(buttonCss).digest('hex'),
  },
};
const args = {
  fullCss,
  rootJs: 'var publishedButton = ' + mapped + ';',
  parity: proof,
  candidateSha,
  candidateVersion,
};

test('extracts exact Button rules, reset/base and tokens from one bound candidate', () => {
  const result = buildTemporaryButtonCss(args);
  assert.equal(result.evidence.status, 'UNPUBLISHED_PACKED_CONSUMER_FIXTURE');
  assert.ok(result.css.startsWith(buttonCss));
  assert.equal(result.css, buttonCss + global + tokens);
  assert.equal(result.evidence.buttonHash, 'abcde');
  assert.equal(result.evidence.selectorCount, names.length);
  assert.ok(result.evidence.cssDifference.rawBytes > 0);
  assert.ok(result.evidence.cssDifference.gzipBytes > 0);
  assert.ok(result.evidence.tokenRootOffset > result.evidence.globalResetOffset);
  assert.equal(result.evidence.blockSha256, proof.embeddedBlock.sha256);
  assert.match(result.evidence.limitations.join(' '), /not exported|does not export/);
});

test('fails closed on a changed block, source or package identity', () => {
  const altered = Buffer.from(fullCss);
  altered[proof.embeddedBlock.byteOffset + 3] = 33;
  assert.throws(
    () => buildTemporaryButtonCss({ ...args, fullCss: altered }),
    /differs from immutable proof/
  );
  assert.throws(
    () => buildTemporaryButtonCss({ ...args, candidateSha: 'b'.repeat(40) }),
    /exact packed Button CSS provenance/
  );
  assert.throws(
    () => buildTemporaryButtonCss({ ...args, candidateVersion: '0.0.0' }),
    /exact packed Button CSS provenance/
  );
});

test('fails closed on ambiguous or absent boundaries and on foreign scoped tail CSS', () => {
  const source = fullCss.toString('utf8');
  assert.throws(() => buildTemporaryButtonCss({
    ...args,
    fullCss: Buffer.from(source.replace(global, global + global)),
  }), /unambiguous global reset/);
  assert.throws(() => buildTemporaryButtonCss({
    ...args,
    fullCss: Buffer.from(source.replace(':root{--space-0:', ':root{--different:')),
  }), /unambiguous token root/);
  assert.throws(() => buildTemporaryButtonCss({
    ...args,
    fullCss: Buffer.from(source.replace(tokens, tokens + '._input_fghij_1{display:grid}')),
  }), /another scoped component/);
});

test('fails closed when packaged JS Button map disagrees with the parity receipt', () => {
  assert.throws(() => buildTemporaryButtonCss({
    ...args,
    rootJs: args.rootJs.replaceAll('abcde', 'fghij'),
  }), /JS Button CSS Modules map differs/);
});
