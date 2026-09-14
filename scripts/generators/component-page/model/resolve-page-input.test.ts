import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  resolvePageInput,
  resolveComponentPageProfile,
  resolveExtractedProps,
} from './resolve-page-input';
import { buildPlaygroundArtifacts } from '../renderers/playground';
import { buildExamples, renderExamples } from '../renderers/examples';

import type { ExtractedProp } from './types';

const tempRoots: string[] = [];

function createFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-page-input-'));
  tempRoots.push(root);

  fs.writeFileSync(
    path.join(root, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        jsx: 'react-jsx',
      },
    })
  );

  for (const packageName of ['react', 'react-native']) {
    const packageRoot = path.join(root, 'packages', packageName);

    fs.mkdirSync(path.join(packageRoot, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, 'tsconfig.json'),
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          rootDir: 'src',
          noEmit: true,
        },
        include: ['src/**/*.ts', 'src/**/*.tsx'],
      })
    );
  }

  const typesRoot = path.join(root, 'packages', 'types', 'src');

  fs.mkdirSync(typesRoot, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'packages', 'types', 'tsconfig.json'),
    JSON.stringify({
      extends: '../../tsconfig.base.json',
      compilerOptions: {
        rootDir: 'src',
        noEmit: true,
      },
      include: ['src/**/*.ts'],
    })
  );
  fs.writeFileSync(path.join(typesRoot, 'index.ts'), '');

  return root;
}

function writeCompoundFixture(params: {
  root: string;
  packageName: 'react' | 'react-native';
  componentName?: string;
  itemProps: string;
}) {
  const componentName = params.componentName ?? 'Example';
  const componentRoot = path.join(
    params.root,
    'packages',
    params.packageName,
    'src',
    'components',
    componentName
  );

  fs.mkdirSync(componentRoot, { recursive: true });
  fs.writeFileSync(
    path.join(componentRoot, 'types.ts'),
    `export type ${componentName}Props = { children?: ReactNode };
type ReactNode = string;
`
  );

  for (const partName of ['Root', 'Item', 'Trigger', 'Content']) {
    const partRoot = path.join(componentRoot, partName);

    fs.mkdirSync(partRoot, { recursive: true });
    fs.writeFileSync(
      path.join(partRoot, `${componentName}${partName}.tsx`),
      `export function ${componentName}${partName}() {
  return null;
}
`
    );
    fs.writeFileSync(
      path.join(partRoot, 'types.ts'),
      partName === 'Item'
        ? params.itemProps
        : `export type ${componentName}${partName}Props = { children?: ReactNode };
type ReactNode = string;
`
    );
  }
}

function writeComponentFixture(params: {
  root: string;
  packageName: 'react' | 'react-native';
  componentName?: string;
  types: string;
}) {
  const componentName = params.componentName ?? 'Example';
  const componentRoot = path.join(
    params.root,
    'packages',
    params.packageName,
    'src',
    'components',
    componentName
  );

  fs.mkdirSync(componentRoot, { recursive: true });
  fs.writeFileSync(path.join(componentRoot, 'types.ts'), params.types);
}

function writeMetadata(params: {
  root: string;
  componentName?: string;
  source: string;
}) {
  const metadataRoot = path.join(
    getCatalogComponentsRoot(params.root),
    params.componentName ?? 'Example'
  );

  fs.mkdirSync(metadataRoot, { recursive: true });
  fs.writeFileSync(path.join(metadataRoot, 'metadata.ts'), params.source);
}

function getCatalogComponentsRoot(root: string) {
  return path.join(
    root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'components'
  );
}

function expectGeneratedChildrenToTypeCheck(params: {
  root: string;
  children: string;
  itemPropsSource: string;
}) {
  const filePath = path.join(params.root, 'generated-composition.tsx');

  fs.writeFileSync(
    filePath,
    `type ReactNode = string | JSX.Element;
declare namespace JSX {
  type Element = unknown;
  interface IntrinsicElements {}
}

${params.itemPropsSource}
type ExampleTriggerProps = { children?: ReactNode };
type ExampleContentProps = { children?: ReactNode };

declare const NativeText: (props: {
  children?: ReactNode;
}) => JSX.Element;

declare const Example: {
  Item: (props: ExampleItemProps) => JSX.Element;
  Trigger: (props: ExampleTriggerProps) => JSX.Element;
  Content: (props: ExampleContentProps) => JSX.Element;
};

const generated = (
  <>
    ${params.children}
  </>
);
void generated;
`
  );

  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      noEmit: true,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  expect(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
  ).toEqual([]);
}

function buildResolvedPlaygroundArtifacts(
  input: Awaited<ReturnType<typeof resolvePageInput>>
) {
  return buildPlaygroundArtifacts({
    componentName: 'Example',
    slug: 'example',
    componentConfig: input.componentConfig,
    playgroundProps: input.playgroundProps,
    reactApiProps: input.reactPlaygroundApiProps,
    nativeApiProps: input.nativePlaygroundApiProps,
    generatedFileHeader: '',
    getChangeHandlerName: input.getChangeHandlerName,
  });
}

function expectGeneratedDemoToTypeCheck(params: {
  root: string;
  componentPropsSource: string;
  playgroundValueSource: string;
  playgroundValueInitializer: string;
  staticProps: string;
  propBindings: string;
}) {
  const filePath = path.join(params.root, 'generated-demo.tsx');

  fs.writeFileSync(
    filePath,
    `declare namespace JSX {
  type Element = unknown;
  interface IntrinsicElements {}
}

${params.componentPropsSource}
declare const Example: (props: ExampleProps) => JSX.Element;
type PlaygroundValue = ${params.playgroundValueSource};
const value: PlaygroundValue = ${params.playgroundValueInitializer};

const generated = (
  <Example
    ${params.staticProps}
    ${params.propBindings}
  />
);
void generated;
`
  );

  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      skipLibCheck: true,
      noEmit: true,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);

  expect(
    diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    )
  ).toEqual([]);
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function prop(name: string): ExtractedProp {
  return {
    name,
    kind: 'boolean',
    required: false,
    type: 'boolean | undefined',
    description: '',
    sourceFilePath: `/tmp/${name}/types.ts`,
  };
}

describe('resolveExtractedProps', () => {
  it('prefers shared base props when they exist', () => {
    const sharedProps = [prop('disabled')];

    expect(
      resolveExtractedProps({
        sharedProps,
        reactApiProps: [prop('checked')],
        nativeApiProps: [prop('required')],
      })
    ).toEqual(sharedProps);
  });

  it('falls back to deduplicated platform props for Generator V2 components', () => {
    const checked = prop('checked');
    const disabled = prop('disabled');
    const required = prop('required');

    expect(
      resolveExtractedProps({
        sharedProps: [],
        reactApiProps: [checked, disabled],
        nativeApiProps: [checked, required],
      }).map((item) => item.name)
    ).toEqual(['checked', 'disabled', 'required']);
  });
});

describe('resolveComponentPageProfile', () => {
  it('uses the explicit Generator V2 profile before name inference', () => {
    expect(
      resolveComponentPageProfile({
        componentName: 'Accordion',
        requestedProfile: 'compound',
      })
    ).toBe('compound');
  });

  it('uses canonical Generator V2 metadata before legacy name inference', () => {
    expect(
      resolveComponentPageProfile({
        componentName: 'Accordion',
        generatedProfile: 'compound',
      })
    ).toBe('compound');
  });

  it('preserves curated component page metadata over the requested profile', () => {
    expect(
      resolveComponentPageProfile({
        componentName: 'Accordion',
        metadataProfile: 'navigation',
        requestedProfile: 'compound',
      })
    ).toBe('navigation');
  });
});

describe('resolvePageInput example platform boundary', () => {
  it.each(['react', 'react-native'] as const)(
    'carries source-derived %s support into overlay example rendering',
    async (platform) => {
      const root = createFixtureRoot();
      writeComponentFixture({
        root,
        packageName: platform,
        types:
          'export type ExampleProps = { open?: boolean; defaultOpen?: boolean };',
      });
      writeMetadata({
        root,
        source: `export default {
          profile: 'overlay',
          examples: [
            { title: 'Controlled', description: 'Controlled.', props: ['open'] },
            { title: 'Uncontrolled', description: 'Uncontrolled.', props: ['defaultOpen'] },
          ],
        };`,
      });
      const input = await resolvePageInput({
        root,
        componentName: 'Example',
        catalogComponentsRoot: getCatalogComponentsRoot(root),
      });
      expect(input.platforms).toEqual([platform]);
      expect(
        platform === 'react' ? input.nativeApiProps : input.reactApiProps
      ).toEqual([]);

      const content = renderExamples({
        ...input,
        componentName: 'Example',
        generatedFileHeader: '',
        generatedExamples: buildExamples({
          ...input,
          componentName: 'Example',
        }),
      });
      expect(content).toContain("title: 'Controlled'");
      expect(content).toContain("title: 'Uncontrolled'");
      expect(content).toContain(`from '@vellira-ui/${platform}';`);
      expect(content).not.toContain(
        `from '@vellira-ui/${platform === 'react' ? 'react-native' : 'react'}';`
      );
    }
  );
});

describe('resolvePageInput related metadata validation', () => {
  it('validates and preserves profile-derived related values before rendering output', async () => {
    const root = createFixtureRoot();

    writeCompoundFixture({
      root,
      packageName: 'react',
      itemProps: `export type ExampleItemProps = { value: string; children?: ReactNode };
type ReactNode = string;
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
      requestedProfile: 'compound',
    });

    expect(input.componentConfig.related).toEqual([
      'tabs',
      'select',
      'dropdown',
    ]);
  });
});

const discriminatedExampleProps = `export type ExampleProps =
  | {
      mode?: 'single';
      value?: string;
      collapsible?: boolean;
      disabled?: boolean;
    }
  | {
      mode: 'multiple';
      value?: string[];
      collapsible?: never;
      multipleOnly?: boolean;
      disabled?: boolean;
    };
`;

describe('resolvePageInput discriminated playgrounds', () => {
  it('selects the optional default branch and excludes the discriminator control', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'value',
      'collapsible',
      'disabled',
    ]);
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'mode'
    );
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'multipleOnly'
    );
    expect(artifacts.reactPropBindings).toContain(
      'collapsible={value.collapsible}'
    );
    expect(artifacts.reactPropBindings).not.toContain('mode=');
    expect(input.getDemoProps('react')).toBe('');

    expectGeneratedDemoToTypeCheck({
      root,
      componentPropsSource: discriminatedExampleProps,
      playgroundValueSource:
        '{ value: string; collapsible: boolean; disabled: boolean }',
      playgroundValueInitializer:
        "{ value: '', collapsible: false, disabled: false }",
      staticProps: input.getDemoProps('react'),
      propBindings: artifacts.reactPropBindings,
    });
  });

  it('uses explicit metadata to select a required branch and emits a static discriminator', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    initialValues: {
      mode: 'multiple',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'mode'
    );
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'collapsible'
    );
    expect(input.getDemoProps('react')).toBe('mode={"multiple"}');
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');

    expectGeneratedDemoToTypeCheck({
      root,
      componentPropsSource: discriminatedExampleProps,
      playgroundValueSource: '{ multipleOnly: boolean; disabled: boolean }',
      playgroundValueInitializer: '{ multipleOnly: false, disabled: false }',
      staticProps: input.getDemoProps('react'),
      propBindings: artifacts.reactPropBindings,
    });
  });

  it('uses demo.staticProps to select a required branch rendered by shared static props', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: "'multiple'",
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'mode'
    );
    expect(input.playgroundProps.map((prop) => prop.name)).not.toContain(
      'collapsible'
    );
    expect(input.getDemoProps('react')).toBe('');

    expectGeneratedDemoToTypeCheck({
      root,
      componentPropsSource: discriminatedExampleProps,
      playgroundValueSource: '{ multipleOnly: boolean; disabled: boolean }',
      playgroundValueInitializer: '{ multipleOnly: false, disabled: false }',
      staticProps: "mode={'multiple'}",
      propBindings: artifacts.reactPropBindings,
    });
  });

  it('uses platform demoProps to select the platform branch', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  react: {
    demoProps: "mode='multiple'",
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.getDemoProps('react')).toBe("mode='multiple'");
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');
  });

  it('lets valid platform demoProps ignore unresolved lower staticProps', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  react: {
    demoProps: "mode='multiple'",
  },
  demo: {
    staticProps: {
      mode: 'someComplexExpression()',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.getDemoProps('react')).toBe("mode='multiple'");
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('lets valid platform demoProps ignore invalid lower staticProps', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  react: {
    demoProps: "mode='multiple'",
  },
  demo: {
    staticProps: {
      mode: "'does-not-exist'",
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.getDemoProps('react')).toBe("mode='multiple'");
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('allows platform demoProps to select divergent React and Native branches', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeComponentFixture({
      root,
      packageName: 'react-native',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  react: {
    demoProps: "mode='multiple'",
  },
  native: {
    demoProps: "mode='single'",
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.reactPlaygroundApiProps.map((prop) => prop.name)).toEqual([
      'mode',
      'value',
      'multipleOnly',
      'disabled',
    ]);
    expect(input.nativePlaygroundApiProps.map((prop) => prop.name)).toEqual([
      'mode',
      'value',
      'collapsible',
      'disabled',
    ]);
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');
    expect(artifacts.nativePropBindings).toContain(
      'collapsible={value.collapsible}'
    );
    expect(artifacts.nativePropBindings).not.toContain('multipleOnly=');
  });

  it('warns and avoids flattened playground fallback for invalid configured discriminator values', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    initialValues: {
      mode: 'invalid',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps).toEqual([]);
    expect(input.getDemoProps('react')).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example react playground demo.initialValues.mode requested mode="invalid", but no matching discriminated-union branch exists.'
    );
  });

  it('warns and avoids branch controls for invalid curated static discriminator values', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: "'invalid'",
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example react playground demo.staticProps.mode requested mode="invalid", but no matching discriminated-union branch exists.'
    );
  });

  it('fails safe when unresolved staticProps precede valid initialValues', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: 'someComplexExpression()',
    },
    initialValues: {
      mode: 'multiple',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps).toEqual([]);
    expect(input.getDemoProps('react')).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example playground could not safely resolve demo.staticProps.mode.'
    );
  });

  it('fails safe when invalid staticProps precede valid initialValues', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: "'does-not-exist'",
    },
    initialValues: {
      mode: 'multiple',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps).toEqual([]);
    expect(input.getDemoProps('react')).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example react playground demo.staticProps.mode requested mode="does-not-exist", but no matching discriminated-union branch exists.'
    );
  });

  it('uses staticProps before initialValues and warns when lower precedence conflicts', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: "'multiple'",
    },
    initialValues: {
      mode: 'single',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.getDemoProps('react')).toBe('');
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example react playground ignored demo.initialValues.mode="single" because demo.staticProps.mode="multiple" has higher precedence.'
    );
  });

  it('lets valid staticProps ignore invalid lower initialValues', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    staticProps: {
      mode: "'multiple'",
    },
    initialValues: {
      mode: 'does-not-exist',
    },
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'multipleOnly',
      'disabled',
    ]);
    expect(input.getDemoProps('react')).toBe('');
    expect(artifacts.reactPropBindings).toContain(
      'multipleOnly={value.multipleOnly}'
    );
    expect(artifacts.reactPropBindings).not.toContain('collapsible=');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps platform-divergent selected branch props separate', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeComponentFixture({
      root,
      packageName: 'react-native',
      types: `export type ExampleProps =
  | {
      mode?: 'single';
      nativeOnly?: boolean;
      disabled?: boolean;
    }
  | {
      mode: 'expanded';
      expandedOnly?: boolean;
      disabled?: boolean;
    };
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });
    const artifacts = buildResolvedPlaygroundArtifacts(input);

    expect(input.reactPlaygroundApiProps.map((prop) => prop.name)).toEqual([
      'mode',
      'value',
      'collapsible',
      'disabled',
    ]);
    expect(input.nativePlaygroundApiProps.map((prop) => prop.name)).toEqual([
      'mode',
      'nativeOnly',
      'disabled',
    ]);
    expect(artifacts.reactPropBindings).toContain(
      'collapsible={value.collapsible}'
    );
    expect(artifacts.reactPropBindings).not.toContain('nativeOnly=');
    expect(artifacts.nativePropBindings).toContain(
      'nativeOnly={value.nativeOnly}'
    );
    expect(artifacts.nativePropBindings).not.toContain('collapsible=');
  });

  it('preserves curated excludeControls for branch-selected controls', async () => {
    const root = createFixtureRoot();

    writeComponentFixture({
      root,
      packageName: 'react',
      types: discriminatedExampleProps,
    });
    writeMetadata({
      root,
      source: `export default {
  demo: {
    excludeControls: ['disabled'],
  },
};
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'value',
      'collapsible',
    ]);
  });

  it('omits incompatible same-name cross-platform selected-branch props', async () => {
    const root = createFixtureRoot();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeComponentFixture({
      root,
      packageName: 'react',
      types: `export type ExampleProps =
  | {
      mode?: 'single';
      value?: string;
      collapsible?: boolean;
    }
  | {
      mode: 'multiple';
      value?: string[];
    };
`,
    });
    writeComponentFixture({
      root,
      packageName: 'react-native',
      types: `export type ExampleProps =
  | {
      mode?: 'single';
      value?: number;
      nativeOnly?: boolean;
    }
  | {
      mode: 'multiple';
      value?: number[];
    };
`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
    });

    expect(input.playgroundProps.map((prop) => prop.name)).toEqual([
      'collapsible',
      'nativeOnly',
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      '⚠️ Example playground omitted cross-platform props with incompatible selected-branch types: value'
    );
  });
});

describe('resolvePageInput compound composition', () => {
  it('derives generated children from each platform compound part prop contract', async () => {
    const root = createFixtureRoot();
    const reactItemProps = `export interface ExampleItemProps {
  webValue: string;
  children?: ReactNode;
}
`;
    const nativeItemProps = `export interface ExampleItemProps {
  nativeCount: number;
  children?: ReactNode;
}
`;

    writeCompoundFixture({
      root,
      packageName: 'react',
      itemProps: `type ReactNode = string;

${reactItemProps}`,
    });
    writeCompoundFixture({
      root,
      packageName: 'react-native',
      itemProps: `type ReactNode = string;

${nativeItemProps}`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
      requestedProfile: 'compound',
    });

    expect(input.componentConfig.react?.children).toContain(
      "<Example.Item webValue='webValue-1'>"
    );
    expect(input.componentConfig.native?.children).toContain(
      '<Example.Item nativeCount={1}>'
    );
    expect(input.componentConfig.native?.children).toContain(
      '<NativeText>Section content</NativeText>'
    );
    expect(input.componentConfig.native?.imports).toContain(
      "import { Text as NativeText } from 'react-native';"
    );
    expect(input.componentConfig.react?.children).not.toBe(
      input.componentConfig.native?.children
    );

    expectGeneratedChildrenToTypeCheck({
      root,
      children: input.componentConfig.react?.children ?? '',
      itemPropsSource: reactItemProps,
    });
    expectGeneratedChildrenToTypeCheck({
      root,
      children: input.componentConfig.native?.children ?? '',
      itemPropsSource: nativeItemProps,
    });
  });

  it('renders apostrophe literal union values as JSX-safe expressions', async () => {
    const root = createFixtureRoot();
    const reactItemProps = `export interface ExampleItemProps {
  mode: "can't" | 'normal';
  children?: ReactNode;
}
`;

    writeCompoundFixture({
      root,
      packageName: 'react',
      itemProps: `type ReactNode = string;

${reactItemProps}`,
    });

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot: getCatalogComponentsRoot(root),
      componentName: 'Example',
      requestedProfile: 'compound',
    });

    expect(input.componentConfig.react?.children).toContain('mode={"can\'t"}');

    expectGeneratedChildrenToTypeCheck({
      root,
      children: input.componentConfig.react?.children ?? '',
      itemPropsSource: reactItemProps,
    });
  });

  it('preserves explicit metadata children instead of generating unsupported complex defaults', async () => {
    const root = createFixtureRoot();
    const catalogComponentsRoot = getCatalogComponentsRoot(root);
    const metadataRoot = path.join(catalogComponentsRoot, 'Example');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeCompoundFixture({
      root,
      packageName: 'react',
      itemProps: `type ReactNode = string;

export interface ExampleItemProps {
  renderItem: (value: string) => ReactNode;
  children?: ReactNode;
}
`,
    });

    fs.mkdirSync(metadataRoot, { recursive: true });
    fs.writeFileSync(
      path.join(metadataRoot, 'metadata.ts'),
      `export default {
  profile: 'compound',
  react: {
    children: '<Example.Item renderItem={() => null}><Example.Trigger>Open</Example.Trigger><Example.Content>Content</Example.Content></Example.Item>',
  },
};
`
    );

    const input = await resolvePageInput({
      root,
      catalogComponentsRoot,
      componentName: 'Example',
      requestedProfile: 'compound',
    });

    expect(input.componentConfig.react?.children).toBe(
      '<Example.Item renderItem={() => null}><Example.Trigger>Open</Example.Trigger><Example.Content>Content</Example.Content></Example.Item>'
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
