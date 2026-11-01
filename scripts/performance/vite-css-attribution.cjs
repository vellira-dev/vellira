// #2014: opt-in CSS source-attribution probe for a packed Vite consumer.
// Does not change public exports, the canonical regression baseline, or CI defaults.
const fs = require('node:fs');
const path = require('node:path');

const { emittedSize } = require('./vite-bundle-size-report.cjs');

const METRICS = ['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes'];

const prefix = [
  "import { StrictMode } from 'react';",
  "import { createRoot } from 'react-dom/client';",
];
const suffix = [
  "const root = document.getElementById('root');",
  "if (!root) throw new Error('Missing Vite root element.');",
  'createRoot(root).render(<StrictMode><App /></StrictMode>);',
  '',
];
const scenarios = {
  tokensOnly: [
    ...prefix,
    "import '@vellira-ui/tokens/css';",
    "function App() { return <main>React-only baseline</main>; }",
    ...suffix,
  ].join('\n'),
  buttonWithoutFullStyles: [
    ...prefix,
    "import '@vellira-ui/tokens/css';",
    "import { Button } from '@vellira-ui/react';",
    "function App() { return <main><Button appearance='solid' color='primary'>Button-only</Button></main>; }",
    ...suffix,
  ].join('\n'),
};

function difference(after, before) {
  return Object.fromEntries(
    METRICS.map((metric) => [metric, after[metric] - before[metric]])
  );
}

function measureCssAttribution(fixtureDir, runBuild, canonicalScenarios) {
  const entry = path.join(fixtureDir, 'src', 'main.tsx');
  const original = fs.readFileSync(entry, 'utf8');
  if (
    !original.includes("import '@vellira-ui/react/styles'") ||
    !original.includes("import { Button, Input } from '@vellira-ui/react'")
  ) {
    throw new Error('CSS probe needs the canonical Button+Input Vite fixture.');
  }
  if (
    !canonicalScenarios?.bare ||
    !canonicalScenarios?.button ||
    typeof runBuild !== 'function'
  ) {
    throw new Error('CSS probe needs prior exact-candidate bare and Button sizes.');
  }

  const observed = {
    bare: canonicalScenarios.bare,
    buttonFullStyles: canonicalScenarios.button,
  };
  try {
    for (const [name, source] of Object.entries(scenarios)) {
      fs.rmSync(path.join(fixtureDir, 'dist'), {
        recursive: true,
        force: true,
      });
      fs.writeFileSync(entry, source);
      runBuild();
      observed[name] = emittedSize(fixtureDir);
    }
  } finally {
    fs.writeFileSync(entry, original);
  }

  return {
    schemaVersion: 1,
    status: 'DIAGNOSTIC_ONLY',
    source: 'one packed candidate; one installed pinned Vite dependency graph',
    scenarios: observed,
    deltas: {
      tokensVsBare: difference(observed.tokensOnly, observed.bare),
      buttonWithoutFullStylesVsTokens: difference(
        observed.buttonWithoutFullStyles,
        observed.tokensOnly
      ),
      fullStylesVsButtonWithoutFullStyles: difference(
        observed.buttonFullStyles,
        observed.buttonWithoutFullStyles
      ),
    },
    limitations: [
      'Missing the documented full stylesheet is not a supported Button usage pattern.',
      'No computed-style, CSS-module class match, theme or accessibility proof.',
      'Build deltas are not an exact allocation of CSS bytes to individual source files.',
      'Emitted assets and gzip are not actual HTTP transfer or runtime memory.',
      'Opt-in probe only; not a new default build, regression baseline, or CI gate.',
    ],
  };
}

function formatCssAttribution(report) {
  const lines = [
    '### CSS attribution diagnostic (#2014, opt-in)',
    '',
    'Status: **DIAGNOSTIC_ONLY**; do not ship the no-full-styles variant.',
    '',
    '| Scenario | JS bytes | JS gzip | CSS bytes | CSS gzip |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const [name, value] of Object.entries(report.scenarios)) {
    lines.push(
      '| ' + name + ' | ' + value.jsBytes + ' | ' +
        value.jsGzipBytes + ' | ' + value.cssBytes + ' | ' +
        value.cssGzipBytes + ' |'
    );
  }
  for (const [name, value] of Object.entries(report.deltas)) {
    lines.push(
      '| Δ ' + name + ' | ' + value.jsBytes + ' | ' +
        value.jsGzipBytes + ' | ' + value.cssBytes + ' | ' +
        value.cssGzipBytes + ' |'
    );
  }
  lines.push('', ...report.limitations.map((item) => '- ' + item), '');
  return lines.join('\n');
}

module.exports = { measureCssAttribution, formatCssAttribution };
