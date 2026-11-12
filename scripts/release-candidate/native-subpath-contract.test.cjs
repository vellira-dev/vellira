const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const {
  ROOT,
  SUBPATHS,
  assertNativeSubpathContract,
} = require('./native-subpath-contract.cjs');

const keys = Object.keys(SUBPATHS);

function withFixture(exports, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-native-graph-'));
  try {
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: '@vellira-ui/react-native',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        'react-native': './dist/index.js',
        exports,
      })
    );
    const targets = new Set([
      'dist/index.js', 'dist/index.d.ts',
      ...Object.values(SUBPATHS).flatMap((entry) =>
        [entry.default.slice(2), entry.types.slice(2)]
      ),
    ]);
    for (const file of targets) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.endsWith('.js') ? 'export {};\n' : '');
    }
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('catalog covers all 17 currently published native runtime components', () => {
  assert.equal(keys.length, 17);
  assert.deepEqual(
    keys.filter((key) => ['.', './button', './select', './theme'].includes(key)),
    ['./button', './select', './theme']
  );
  assert.equal(SUBPATHS['./button'].types, './dist/primitives/Button/index.d.ts');
  assert.equal(SUBPATHS['./select'].default, './dist/select.js');
  assert.equal(SUBPATHS['./select']['vellira-source'], './src/components/Select/index.ts');
  assert.equal(SUBPATHS['./theme'].types, './dist/theme/index.d.ts');
});

test('enforces a complete published shared graph and all declaration targets', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    assert.deepEqual(assertNativeSubpathContract(dir), {
      enabled: true,
      checkedTargets: 36,
      checkedJsFiles: 18,
    });
  });
});

test('legacy root-only shape is for explicit historical inspection only', () => {
  withFixture({ '.': ROOT }, (dir) => {
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /shared-subpath export set missing/
    );
    assert.deepEqual(
      assertNativeSubpathContract(dir, { allowLegacyRootOnly: true }),
      { enabled: false, checkedTargets: 2, checkedJsFiles: 1 }
    );
  });
});

test('rejects partial rollout, changed root, and unexpected exports', () => {
  withFixture({ '.': ROOT, './button': SUBPATHS['./button'] }, (dir) => {
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /introduced together/
    );
  });
  withFixture({
    '.': { ...ROOT, default: './dist/button.js' },
    ...SUBPATHS,
  }, (dir) => {
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /root export contract changed/
    );
  });
  withFixture({ '.': ROOT, ...SUBPATHS, './unsafe': './dist/x.js' }, (dir) => {
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Unexpected native export/
    );
  });
});

test('rejects missing entries and missing transitive shared chunks', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.rmSync(path.join(dir, 'dist/select.js'));
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Missing packed native export target/
    );
  });
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.writeFileSync(
      path.join(dir, 'dist/button.js'),
      'import { shared } from "./chunk-that-is-missing.js";\nexport { shared };\n'
    );
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Missing packed native JS chunk/
    );
  });
});

test('rejects imports escaping the packed dist graph', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.writeFileSync(
      path.join(dir, 'dist/button.js'),
      'export { default } from "../secret.js";\n'
    );
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Unsafe native JS chunk import/
    );
  });
});

test('rejects an unreferenced or experimental JS chunk in the publishable tree', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.mkdirSync(path.join(dir, 'dist/shared-proof'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'dist/shared-proof/index.js'), 'export {};\\n');
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Unreferenced native JS files would be published/
    );
  });
});

test('accepts shared chunks consumed by root and leaf entries once', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.writeFileSync(path.join(dir, 'dist/chunk-shared.js'), 'export const shared = 1;\n');
    for (const name of ['index.js', 'button.js', 'theme.js']) {
      fs.writeFileSync(
        path.join(dir, 'dist', name),
        "import { shared } from './chunk-shared.js';\nexport { shared };\n"
      );
    }
    const actual = assertNativeSubpathContract(dir);
    assert.equal(actual.checkedJsFiles, 19);
  });
});

test('rejects missing chunks reached via comments, re-exports and multiline imports', () => {
  const examples = [
    "import(/* comment */ './missing.js');",
    "import(\n /* retained */ \n './missing.js'\n);",
    "require(/* retained */ './missing.js');",
    "export { part } from /* retained */ './missing.js';",
    "import { part } from\n './missing.js';",
    "export * from './missing.js';",
  ];
  for (const code of examples) {
    withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
      fs.writeFileSync(path.join(dir, 'dist/button.js'), code + '\n');
      assert.throws(
        () => assertNativeSubpathContract(dir),
        /Missing packed native JS chunk/,
        code
      );
    });
  }
});

test('rejects computed dynamic import and require expressions, even if string-like', () => {
  const examples = [
    "import('./' + 'missing.js');",
    "import(`./missing-${name}.js`);",
    "require('./' + name);",
    "import(variable);",
  ];
  for (const code of examples) {
    withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
      fs.writeFileSync(path.join(dir, 'dist/button.js'), code + '\n');
      assert.throws(
        () => assertNativeSubpathContract(dir),
        /Nonliteral packed Native JS import/,
        code
      );
    });
  }
});

test('parses comments and strings without creating fake import edges', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.writeFileSync(path.join(dir, 'dist/button.js'),
      '// import("./not-an-edge.js")\n' +
      'const text = "export * from ./not-an-edge.js";\n' +
      'export {};\n'
    );
    assert.equal(assertNativeSubpathContract(dir).checkedJsFiles, 18);
  });
});

test('rejects syntactically invalid packed JS', () => {
  withFixture({ '.': ROOT, ...SUBPATHS }, (dir) => {
    fs.writeFileSync(path.join(dir, 'dist/button.js'), 'import { from;\n');
    assert.throws(
      () => assertNativeSubpathContract(dir),
      /Unparseable packed Native JS/
    );
  });
});
