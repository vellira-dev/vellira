// #470: report-only size observations on one exact, clean Vite candidate.
// Every variant uses the same installed dependencies and pinned toolchain.
// No change is made to public package sources or published exports.
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');

function emittedSize(fixtureDir) {
  const dir = path.join(fixtureDir, 'dist', 'assets');
  if (!fs.existsSync(path.join(fixtureDir, 'dist', 'index.html')) ||
      !fs.existsSync(dir)) {
    throw new Error('Vite size proof is missing its production output.');
  }
  const totals = {
    jsBytes: 0, jsGzipBytes: 0, jsFiles: 0,
    cssBytes: 0, cssGzipBytes: 0, cssFiles: 0,
  };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const kind = entry.name.endsWith('.js')
      ? 'js' : entry.name.endsWith('.css') ? 'css' : null;
    if (!kind) continue;
    const data = fs.readFileSync(path.join(dir, entry.name));
    totals[kind + 'Bytes'] += data.byteLength;
    totals[kind + 'GzipBytes'] += gzipSync(data, { level: 9 }).byteLength;
    totals[kind + 'Files'] += 1;
  }
  if (totals.jsFiles < 1 || totals.jsBytes < 100) {
    throw new Error('Vite size proof must contain a nontrivial JavaScript asset.');
  }
  return totals;
}

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
const bareSource = [...prefix,
  "function App() { return <main>React-only baseline</main>; }",
  ...suffix,
].join('\n');
const buttonSource = [...prefix,
  "import '@vellira-ui/tokens/css';",
  "import '@vellira-ui/react/styles';",
  "import { Button } from '@vellira-ui/react';",
  "function App() { return <main><Button appearance='solid' color='primary'>Button-only</Button></main>; }",
  ...suffix,
].join('\n');

function difference(after, before) {
  const result = {};
  for (const field of ['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes']) {
    result[field] = after[field] - before[field];
  }
  return result;
}

function measureViteBundleVariants(fixtureDir, runBuild) {
  const entry = path.join(fixtureDir, 'src', 'main.tsx');
  const original = fs.readFileSync(entry, 'utf8');
  if (!original.includes("import { Button, Input } from '@vellira-ui/react'") ||
      !original.includes("import '@vellira-ui/react/styles'")) {
    throw new Error('Size proof requires the canonical Button+Input consumer.');
  }

  // The canonical clean-consumer production build has just succeeded.
  const scenarios = { buttonInput: emittedSize(fixtureDir) };
  try {
    for (const [name, source] of [
      ['bare', bareSource],
      ['button', buttonSource],
    ]) {
      // Avoid stale output being misattributed to a new scenario.
      fs.rmSync(path.join(fixtureDir, 'dist'), { recursive: true, force: true });
      fs.writeFileSync(entry, source);
      runBuild();
      scenarios[name] = emittedSize(fixtureDir);
    }
  } finally {
    fs.writeFileSync(entry, original);
  }

  if (scenarios.button.cssFiles < 1 || scenarios.buttonInput.cssFiles < 1) {
    throw new Error('A styled Vellira consumer must emit CSS.');
  }
  return {
    schemaVersion: 1,
    source: 'same exact packed candidate / same Vite dependency graph',
    metric: 'sum of emitted production .js and .css assets; gzip level 9 per asset',
    comparisons: ['button minus bare', 'buttonInput minus button'],
    scenarios,
    deltas: {
      buttonVsBare: difference(scenarios.button, scenarios.bare),
      buttonInputVsButton: difference(scenarios.buttonInput, scenarios.button),
    },
    limitations: [
      'Representative Button+Input is not the full component catalog.',
      'Gzip is calculated per emitted asset; it is not HTTP transfer or runtime memory.',
      'This reports within-candidate consumer deltas, not a regression versus main.',
      'No budget threshold is enforced. Native Metro measurement is separate.',
    ],
  };
}

function sizeReportMarkdown(evidence) {
  function fmt(n) { return String(n); }
  const cases = evidence.scenarios;
  const lines = [
    '### Vite size observation (report-only, #470)',
    '',
    '| Scenario | JS bytes | JS gzip bytes | CSS bytes | CSS gzip bytes |',
    '| --- | ---: | ---: | ---: | ---: |',
  ];
  for (const [name, data] of Object.entries(cases)) {
    lines.push('| ' + name + ' | ' + fmt(data.jsBytes) +
      ' | ' + fmt(data.jsGzipBytes) + ' | ' +
      fmt(data.cssBytes) + ' | ' + fmt(data.cssGzipBytes) + ' |');
  }
  for (const [name, data] of Object.entries(evidence.deltas)) {
    lines.push('| Δ ' + name + ' | ' + fmt(data.jsBytes) +
      ' | ' + fmt(data.jsGzipBytes) + ' | ' +
      fmt(data.cssBytes) + ' | ' + fmt(data.cssGzipBytes) + ' |');
  }
  lines.push('', 'Same locked dependencies and packed candidate for all cases. ' +
    'No performance threshold, cross-commit comparison or Native Metro claim.', '');
  return lines.join('\n');
}

module.exports = { emittedSize, measureViteBundleVariants, sizeReportMarkdown };
