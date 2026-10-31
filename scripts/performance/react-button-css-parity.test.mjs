import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  buttonModuleMap,
  verifyButtonCssParity,
} = require('./react-button-css-parity.cjs');

const name = (n) => '_' + n + '_abcde_1';
const classes = [
  'button', 'solid', 'loading', 'spinner', 'primary', 'neutral',
  'disabled', 'pill', 'rounded', 'sm', 'md', 'lg', 'badge', 'icon',
];
const buttonMap = '{\n' +
  classes.map((n) => n + ': "' + name(n) + '"').join(',\n') +
  ',\n"button-spin": "' + name('button-spin') + '"\n}';
const indexJs = [
  'var unrelated = { button: "_button_other_1", disabled: "_disabled_other_2" };',
  'var publishedButton = ' + buttonMap + ';',
].join('\n');
const css = classes.map((n) => '.' + name(n) + '{display:block}').join('') +
  '@keyframes ' + name('button-spin') + '{to{transform:rotate(360deg)}}';

test('identifies the published Button module rather than a Dropdown-like button', () => {
  const result = buttonModuleMap(indexJs);
  assert.equal(result.hash, 'abcde');
  assert.equal(result.names.length, classes.length + 1);
  assert.ok(result.names.includes(name('button-spin')));
});

test('accepts actual generated class/animation parity without claiming visual equivalence', () => {
  const actual = verifyButtonCssParity({
    rootJs: indexJs,
    fullCss: '.other{a:b}' + css,
    isolatedCss: css,
  });
  assert.equal(actual.state, 'CLASS_PARITY_ONLY');
  assert.equal(actual.buttonModuleHash, 'abcde');
  assert.equal(actual.verifiedSelectorCount, classes.length);
  assert.deepEqual(actual.verifiedAnimationNames, [name('button-spin')]);
  assert.ok(actual.publishedAggregate.raw > actual.isolatedButtonModule.raw);
  assert.equal(actual.limitations.some((s) => s.includes('computed-style')), true);
  assert.equal(actual.schemaVersion, 1);
});

test('rejects missing classes, animation, foreign component and token duplication', () => {
  const missing = css.replace('.' + name('spinner') + '{display:block}', '');
  assert.throws(
    () => verifyButtonCssParity({ rootJs: indexJs, fullCss: css, isolatedCss: missing }),
    /missing class/
  );
  assert.throws(
    () => verifyButtonCssParity({
      rootJs: indexJs,
      fullCss: css,
      isolatedCss: css.replace('@keyframes ' + name('button-spin'), '@keyframes other-spin'),
    }),
    /keyframes/
  );
  assert.throws(
    () => verifyButtonCssParity({
      rootJs: indexJs,
      fullCss: css,
      isolatedCss: css + '._input_fghij_1{display:block}',
    }),
    /other component module/
  );
  assert.throws(
    () => verifyButtonCssParity({
      rootJs: indexJs,
      fullCss: css,
      isolatedCss: css + ':root{--space-0:0px}',
    }),
    /token stylesheet/
  );
});

test('fails closed on absent, ambiguous or incomplete packaged class maps', () => {
  assert.throws(() => buttonModuleMap(''), /Cannot uniquely/);
  assert.throws(() => buttonModuleMap(indexJs + '\n' + buttonMap.replaceAll('abcde', 'fghij')),
    /Cannot uniquely/);
  assert.throws(
    () => verifyButtonCssParity({
      rootJs: indexJs,
      fullCss: css.replace('.' + name('pill'), '.missing'),
      isolatedCss: css,
    }),
    /aggregate CSS is missing/
  );
  assert.throws(
    () => verifyButtonCssParity({ rootJs: indexJs, fullCss: '', isolatedCss: css }),
    /Missing emitted/
  );
});
