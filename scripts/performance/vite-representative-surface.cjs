// #470 Phase B: one wider real-world Web consumer, outside the
// versioned PR-vs-main baseline schema. Do not change the canonical fixture.
const fs = require('node:fs');
const path = require('node:path');
const { emittedSize } = require('./vite-bundle-size-report.cjs');

const components = [
  'Button', 'Input', 'Checkbox', 'Switch', 'Textarea',
  'Select', 'Tabs', 'Dropdown', 'Tooltip', 'Modal', 'Portal',
];

// Published-root imports only. Keep the documented full styles import to
// measure real adoption cost without assuming CSS tree-shaking or new exports.
const source = [
  "import { StrictMode } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import '@vellira-ui/tokens/css';",
  "import '@vellira-ui/react/styles';",
  "import { Button, Input, Checkbox, Switch, Textarea, Select, Tabs, Dropdown, Tooltip, Modal, Portal } from '@vellira-ui/react';",
  '',
  'function App() {',
  '  return (',
  "    <main aria-label='Representative Vellira workspace'>",
  "      <Input label='Project name' defaultValue='Factory' />",
  "      <Checkbox label='Ready for review' defaultChecked />",
  '      <Switch defaultChecked />',
  "      <Textarea defaultValue='Workspace notes' />",
  "      <Select label='Country' options={[{ label: 'France', value: 'fr' }, { label: 'Spain', value: 'es' }]} />",
  "      <Tabs defaultValue='overview'>",
  "        <Tabs.List aria-label='Workspace sections'>",
  "          <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>",
  "          <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>",
  '          <Tabs.Indicator />',
  '        </Tabs.List>',
  "        <Tabs.Content value='overview'>Overview panel</Tabs.Content>",
  "        <Tabs.Content value='settings'>Settings panel</Tabs.Content>",
  '      </Tabs>',
  '      <Dropdown>',
  '        <Dropdown.Trigger asChild><Button>Actions</Button></Dropdown.Trigger>',
  '        <Dropdown.Content>',
  '          <Dropdown.Item>Share</Dropdown.Item>',
  '        </Dropdown.Content>',
  '      </Dropdown>',
  '      <Tooltip>',
  '        <Tooltip.Trigger asChild><Button>Help</Button></Tooltip.Trigger>',
  '        <Portal><Tooltip.Content>Workspace assistance</Tooltip.Content></Portal>',
  '      </Tooltip>',
  '      <Modal>',
  '        <Modal.Trigger asChild><Button>Open preferences</Button></Modal.Trigger>',
  '        <Portal>',
  '          <Modal.Overlay />',
  '          <Modal.Content>',
  '            <Modal.Header><Modal.Title>Preferences</Modal.Title></Modal.Header>',
  '            <Modal.Body>Configure workspace</Modal.Body>',
  '          </Modal.Content>',
  '        </Portal>',
  '      </Modal>',
  '    </main>',
  '  );',
  '}',
  '',
  "const root = document.getElementById('root');",
  "if (!root) throw new Error('Missing Vite root element.');",
  'createRoot(root).render(<StrictMode><App /></StrictMode>);',
  '',
].join('\n');

function delta(after, before) {
  return Object.fromEntries(
    ['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes'].map(
      (field) => [field, after[field] - before[field]]
    )
  );
}

function measureRepresentativeWeb(fixtureDir, buildAndTypecheck, canonical) {
  const entry = path.join(fixtureDir, 'src', 'main.tsx');
  const original = fs.readFileSync(entry, 'utf8');
  if (!original.includes("import { Button, Input } from '@vellira-ui/react'")) {
    throw new Error('The exact Vite clean consumer has changed unexpectedly.');
  }
  if (!canonical || !Number.isSafeInteger(canonical.jsBytes) ||
      !Number.isSafeInteger(canonical.cssBytes)) {
    throw new Error('Representative proof requires measured Button+Input.');
  }

  try {
    fs.rmSync(path.join(fixtureDir, 'dist'), { recursive: true, force: true });
    fs.writeFileSync(entry, source);
    // Includes a clean-consumer TypeScript check before the Vite production build.
    buildAndTypecheck();
    const emitted = emittedSize(fixtureDir);
    if (emitted.cssFiles < 1 || emitted.cssBytes < 1000) {
      throw new Error('Representative Web fixture did not emit full Vellira CSS.');
    }
    return {
      schemaVersion: 1,
      case: 'representative-web-components',
      components,
      importContract: 'published root API with documented full CSS',
      emitted,
      deltaFromButtonInput: delta(emitted, canonical),
      limitations: [
        'This is a representative composition, not the complete catalog.',
        'It does not change the existing PR-versus-main baseline schema.',
        'Full stylesheet is explicitly imported; CSS size is not CSS usage.',
        'Emitted gzip asset sizes do not equal network transfer or runtime cost.',
      ],
    };
  } finally {
    fs.writeFileSync(entry, original);
  }
}

function formatRepresentativeWeb(report) {
  const r = report.emitted;
  const d = report.deltaFromButtonInput;
  return [
    '### Representative Web component footprint (#470, report-only)',
    '',
    'Published-root components: ' + report.components.join(', '),
    '',
    '| Metric | Representative | Delta vs Button + Input |',
    '| --- | ---: | ---: |',
    ...['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes'].map((key) =>
      '| ' + key + ' | ' + r[key] + ' | ' +
      (d[key] >= 0 ? '+' : '') + d[key] + ' |'
    ),
    '',
    'This is within one packed candidate and toolchain, **not** a PR-vs-main ' +
      'comparison or the entire catalog. Explicit full styles import retained.',
    '',
  ].join('\n');
}

module.exports = {
  components, source, measureRepresentativeWeb, formatRepresentativeWeb,
};
