import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const fixtureRoots: string[] = [];

function repoRoot() {
  return process.cwd();
}

function copyIfExists(root: string, fixture: string, relativePath: string) {
  const source = path.join(root, relativePath);
  const target = path.join(fixture, relativePath);

  if (!fs.existsSync(source)) return;

  fs.cpSync(source, target, {
    recursive: true,
    filter: (item) =>
      !item.includes(`${path.sep}.next${path.sep}`) &&
      !item.includes(`${path.sep}dist${path.sep}`) &&
      !item.includes(`${path.sep}coverage${path.sep}`),
  });
}

function createFixtureRepo() {
  const root = repoRoot();
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-page-cli-')
  );
  fixtureRoots.push(fixture);

  for (const relativePath of [
    'apps',
    'packages',
    'scripts',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'tsconfig.base.json',
    'tsconfig.tooling.json',
    'tsconfig.tooling.test.json',
    'vitest.config.ts',
    'vitest.tooling.config.ts',
    '.prettierrc.js',
    '.prettierignore',
  ]) {
    copyIfExists(root, fixture, relativePath);
  }

  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(fixture, 'node_modules')
  );

  return fixture;
}

function runGenerator(
  fixture: string,
  args: readonly string[]
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return spawnSync(
    'node',
    [
      path.join(repoRoot(), 'node_modules/tsx/dist/cli.mjs'),
      'scripts/generators/component-page/create-component-page.ts',
      ...args,
    ],
    {
      cwd: fixture,
      encoding: 'utf8',
    }
  );
}

function runAudit(
  fixture: string,
  componentName = 'Button'
): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return spawnSync(
    'node',
    [
      path.join(repoRoot(), 'node_modules/tsx/dist/cli.mjs'),
      'scripts/generators/component-page/audit-component-pages.ts',
      '--component',
      componentName,
    ],
    {
      cwd: fixture,
      encoding: 'utf8',
    }
  );
}

function generatedButtonApiPath(fixture: string) {
  return path.join(
    fixture,
    'apps/website/src/component-catalog/components/Button/buttonApi.ts'
  );
}

function generatedButtonFiles(fixture: string) {
  const root = path.join(
    fixture,
    'apps/website/src/component-catalog/components/Button'
  );

  return [
    'ButtonAccessibility.tsx',
    'ButtonDemo.tsx',
    'ButtonExamples.tsx',
    'ButtonPlayground.tsx',
    'ButtonUsage.tsx',
    'NativeButtonDemo.tsx',
    'buttonApi.ts',
    'buttonPlaygroundSchema.ts',
    'index.ts',
  ].map((fileName) => path.join(root, fileName));
}

function fixtureStateFiles(fixture: string) {
  return [
    ...generatedButtonFiles(fixture),
    path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    ),
    path.join(
      fixture,
      'apps/website/src/component-catalog/registry/componentPages.ts'
    ),
    path.join(
      fixture,
      'apps/website/src/component-catalog/registry/componentPresentation.ts'
    ),
  ];
}

function snapshotFiles(filePaths: readonly string[]) {
  return new Map(
    filePaths.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')])
  );
}

function restoreFiles(snapshot: Map<string, string>) {
  for (const [filePath, content] of snapshot) {
    fs.writeFileSync(filePath, content);
  }
}

function expectFilesUnchanged(snapshot: Map<string, string>) {
  for (const [filePath, content] of snapshot) {
    expect(fs.readFileSync(filePath, 'utf8')).toBe(content);
  }
}

function createCanonicalFixtureRepo() {
  const fixture = createFixtureRepo();
  const result = runGenerator(fixture, ['Button', '--force']);

  expect(
    result.status,
    [result.stdout, result.stderr].filter(Boolean).join('\n')
  ).toBe(0);
  expect(result.stderr).toBe('');

  return fixture;
}

let fixture: string;
let canonicalState: Map<string, string>;

beforeAll(() => {
  fixture = createCanonicalFixtureRepo();
  canonicalState = snapshotFiles(fixtureStateFiles(fixture));
}, 60_000);

beforeEach(() => {
  restoreFiles(canonicalState);
});

afterAll(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe('component page CLI check modes', { concurrent: false }, () => {
  it('loads semantic vocabulary without the metadata package runtime', async () => {
    vi.resetModules();
    vi.doMock('@vellira-ui/metadata', () => {
      throw new Error(
        'The metadata package runtime must not be loaded by semantic contract tooling.'
      );
    });

    try {
      const { buildSemanticMetadataContract } =
        await import('./semantic-metadata-contract');
      const { validateRelatedComponentSlugs } =
        await import('./metadata/metadata');
      const contract = buildSemanticMetadataContract({
        root: process.cwd(),
        componentName: 'FutureComponent',
      });

      expect(contract.relatedComponentRegistry.slugs).toContain('radio-group');
      expect(
        validateRelatedComponentSlugs({
          componentName: 'FutureComponent',
          related: ['radio-group'],
        })
      ).toEqual([]);
    } finally {
      vi.doUnmock('@vellira-ui/metadata');
      vi.resetModules();
    }
  });

  it('keeps human-readable check compatible with registry validation', () => {
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, ['Button', '--force', '--check']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'Generated component page is up to date: Button'
    );
    expect(result.stdout).toContain(
      'Skipped component catalog registration: button'
    );
    expect(result.stderr).toBe('');
    expectFilesUnchanged(before);
  }, 60_000);

  it('emits structured JSON check output with valid registry paths', () => {
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '2',
      componentName: 'Button',
      status: 'up-to-date',
      staleFiles: [],
    });
    expectFilesUnchanged(before);
  }, 60_000);

  it('reports stale generated files in JSON check mode without mutating them', () => {
    const apiFile = generatedButtonApiPath(fixture);
    const staleContent = `${fs.readFileSync(apiFile, 'utf8')}\n// stale fixture drift\n`;
    fs.writeFileSync(apiFile, staleContent);
    const before = snapshotFiles(generatedButtonFiles(fixture));

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    const payload = JSON.parse(result.stdout);
    expect(payload).toEqual({
      schemaVersion: '2',
      componentName: 'Button',
      status: 'stale',
      staleFiles: [
        'apps/website/src/component-catalog/components/Button/buttonApi.ts',
      ],
    });
    expect(payload.staleFiles).toEqual([...payload.staleFiles].sort());
    expectFilesUnchanged(before);
  }, 60_000);

  it('fails --check when effective related metadata is non-canonical', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source.replace(
        "related: ['input', 'checkbox', 'modal']",
        "related: ['Input']"
      )
    );

    const result = runGenerator(fixture, ['Button', '--force', '--check']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Button related[0] "Input" is invalid: unknown or non-canonical related component slug'
    );
  }, 60_000);

  it('fails audit through shared related metadata validation', () => {
    const registryFile = path.join(
      fixture,
      'apps/website/src/component-catalog/registry/componentPages.ts'
    );
    const source = fs.readFileSync(registryFile, 'utf8');

    fs.writeFileSync(
      registryFile,
      source.replace(
        "related: ['input', 'checkbox', 'modal']",
        "related: ['Input']"
      )
    );

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'button related[0] "Input" is invalid: unknown or non-canonical related component slug'
    );
  }, 60_000);

  it('fails audit when effective metadata omits a related-components decision', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source.replace("  related: ['input', 'checkbox', 'modal'],\n", '')
    );

    const result = runAudit(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /Button: effective generator input invalid:[\s\S]*related must be explicitly defined; use related: \[\] when no related components are intended/
    );
  }, 60_000);

  it('allows an incomplete related decision during scaffold generation but rejects it in check mode', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source.replace("  related: ['input', 'checkbox', 'modal'],\n", '')
    );

    const scaffold = runGenerator(fixture, ['Button', '--force']);
    expect(scaffold.status).toBe(0);

    const check = runGenerator(fixture, ['Button', '--force', '--check']);
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('related must be explicitly defined');
  }, 60_000);

  it('fails audit when a generated preview lacks an explicit catalog preview decision', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Textarea/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source.replace(/ {2}catalogPreview: \{[\s\S]*?\n {2}\},\n/, '')
    );

    const result = runAudit(fixture, 'Textarea');

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /Textarea: effective generator input invalid:[\s\S]*catalogPreview must be explicitly defined/
    );
  }, 60_000);

  it('returns all canonical semantic findings together in JSON check mode', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Textarea/metadata.ts'
    );
    const source = fs.readFileSync(metadataFile, 'utf8');

    fs.writeFileSync(
      metadataFile,
      source
        .replace(/ {2}catalogPreview: \{[\s\S]*?\n {2}\},\n/, '')
        .replace(/ {2}related: \[[\s\S]*?\n {2}\],\n/, '')
    );

    const result = runGenerator(fixture, [
      'Textarea',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '2',
      componentName: 'Textarea',
      status: 'semantic-invalid',
      metadataPath:
        'apps/website/src/component-catalog/components/Textarea/metadata.ts',
      analysisComplete: true,
      apiDescriptionAnalysis: 'available',
      findings: expect.arrayContaining([
        expect.stringContaining('related must be explicitly defined'),
        expect.stringContaining('catalogPreview must be explicitly defined'),
      ]),
    });
  }, 60_000);

  it('returns a structured semantic finding for invalid metadata runtime shape', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(metadataFile, `export default { examples: {} } as any;\n`);

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '2',
      componentName: 'Button',
      status: 'semantic-invalid',
      metadataPath:
        'apps/website/src/component-catalog/components/Button/metadata.ts',
      analysisComplete: false,
      apiDescriptionAnalysis: 'available',
      findings: expect.arrayContaining([
        'examples must be an array',
        expect.stringContaining('related must be explicitly defined'),
      ]),
    });
  }, 60_000);

  it('aggregates malformed examples with every independent required decision', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Textarea/metadata.ts'
    );

    fs.writeFileSync(metadataFile, `export default { examples: {} } as any;\n`);

    const result = runGenerator(fixture, [
      'Textarea',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(payload.analysisComplete).toBe(false);
    expect(payload.apiDescriptionAnalysis).toBe('available');
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'examples must be an array',
        expect.stringContaining('related must be explicitly defined'),
        expect.stringContaining('catalogPreview must be explicitly defined'),
      ])
    );
  }, 60_000);

  it('blocks only API-dependent analysis when the API subtree is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(metadataFile, `export default { api: 42 } as any;\n`);

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(payload.analysisComplete).toBe(false);
    expect(payload.apiDescriptionAnalysis).toBe('blocked');
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'api must be an object',
        expect.stringContaining('related must be explicitly defined'),
      ])
    );
  }, 60_000);

  it('keeps semantic analysis for valid siblings in a partially malformed examples array', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  examples: [
    { title: 'Valid sibling', description: 'Still analyzed.', props: ['missingProp={true}'] },
    42,
  ],
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.apiDescriptionAnalysis).toBe('available');
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'examples[1] must be an object',
        expect.stringContaining(
          'examples[0].props prop fragment "missingProp" is not present in the react API'
        ),
      ])
    );
  }, 60_000);

  it('preserves original array indexes when an earlier example is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  examples: [
    42,
    { title: 'Later sibling', description: 'Still analyzed.', props: ['missingProp={true}'] },
  ],
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'examples[0] must be an object',
        expect.stringContaining(
          'examples[1].props prop fragment "missingProp" is not present in the react API'
        ),
      ])
    );
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('examples[0].props prop fragment'),
      ])
    );
  }, 60_000);

  it('keeps platform sibling semantics when another platform field is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  react: { imports: 42, demoProps: 'missingProp={true}' },
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'react.imports must be an array',
        expect.stringContaining(
          'react.demoProps prop fragment "missingProp" is not present in the react API'
        ),
      ])
    );
  }, 60_000);

  it('keeps example prop semantics when an independent required field is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  examples: [
    { title: 42, description: 'Still analyzed.', props: ['missingProp={true}'] },
  ],
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'examples[0].title must be a string',
        expect.stringContaining(
          'examples[0].props prop fragment "missingProp" is not present in the react API'
        ),
      ])
    );
  }, 60_000);

  it('keeps API descriptions analyzable when only API sections are malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  api: { sections: 42, descriptions: { unknown: 'Still inspectable.' } },
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.apiDescriptionAnalysis).toBe('available');
    expect(payload.findings).toContain('api.sections must be an array');
  }, 60_000);

  it('keeps child binding props analyzable when the binding target is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  react: {
    childPropBindings: [{ target: 42, props: ['missingProp={true}'] }],
  },
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'react.childPropBindings[0].target must be a string',
        expect.stringContaining(
          'react.childPropBindings[0].props prop fragment "missingProp" is not present in the react API'
        ),
      ])
    );
  }, 60_000);

  it('keeps duplicate API section names analyzable when an export is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  api: {
    sections: [
      { name: 'Duplicate', exportName: 42 },
      { name: 'Duplicate', exportName: 'Button' },
    ],
  },
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.analysisComplete).toBe(false);
    expect(payload.apiDescriptionAnalysis).toBe('available');
    expect(payload.findings).toEqual(
      expect.arrayContaining([
        'api.sections[0].exportName must be a string or platform object',
        'duplicate API section "Duplicate"',
      ])
    );
  }, 60_000);

  it('does not let analysis placeholders invent API section findings', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  api: {
    sections: [
      { name: 42, exportName: 'Button' },
      { name: '__invalid_section_0', exportName: 'Button' },
    ],
  },
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.apiDescriptionAnalysis).toBe('available');
    expect(payload.findings).toContain('api.sections[0].name must be a string');
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('duplicate API section "__invalid_section_0"'),
      ])
    );
  }, 60_000);

  it('does not infer target platforms when the authored platform field is malformed', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(
      metadataFile,
      `export default {
  related: [],
  examples: [
    {
      title: 'Unknown target',
      description: 'Target authority is malformed.',
      props: ['missingProp={true}'],
      platforms: [42, 'react'],
    },
  ],
} as any;\n`
    );

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);
    const payload = JSON.parse(result.stdout);

    expect(result.status).toBe(2);
    expect(payload.findings).toContain(
      'examples[0].platforms[0] must be a string'
    );
    expect(payload.findings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('missingProp')])
    );
  }, 60_000);

  it('returns a structured semantic finding for metadata syntax failure', () => {
    const metadataFile = path.join(
      fixture,
      'apps/website/src/component-catalog/components/Button/metadata.ts'
    );

    fs.writeFileSync(metadataFile, `export default { examples: [ };\n`);

    const result = runGenerator(fixture, [
      'Button',
      '--force',
      '--check',
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      schemaVersion: '2',
      componentName: 'Button',
      status: 'semantic-invalid',
      metadataPath:
        'apps/website/src/component-catalog/components/Button/metadata.ts',
      analysisComplete: false,
      apiDescriptionAnalysis: 'blocked',
      findings: ['metadata.ts could not be loaded as a TypeScript module'],
    });
  }, 60_000);
});
