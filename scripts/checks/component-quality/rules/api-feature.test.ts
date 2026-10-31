import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  componentMetadata,
  type ComponentMetadata,
} from '@vellira-ui/metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  controlledContractRule,
  declaredCapabilitiesRule,
  publicApiSurfaceRule,
  sharedTypeContractRule,
} from './api-feature';

const metadata: ComponentMetadata = {
  name: 'Example',
  layer: 'components',
  category: 'form',
  platforms: ['react', 'react-native'],
  profile: 'base',
  status: 'stable',
  capabilities: ['controlled', 'uncontrolled', 'disabled', 'loading'],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
};

const tempRoots: string[] = [];

function createComponent(params: {
  platform?: 'react' | 'react-native';
  indexSource?: string;
  typesSource?: string;
  implementationSource?: string;
  rootTypesSource?: string;
  rootImplementationSource?: string;
  metadataOverride?: ComponentMetadata;
  sharedTypeSource?: string;
  sharedBarrelSource?: string;
}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-quality-'));
  tempRoots.push(root);
  const platform = params.platform ?? 'react';
  const componentDir = path.join(
    root,
    'packages',
    platform,
    'src',
    'components',
    'Example'
  );

  fs.mkdirSync(componentDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentDir, 'index.ts'),
    params.indexSource ?? "export { Example } from './Example';\n"
  );
  fs.writeFileSync(
    path.join(componentDir, 'types.ts'),
    params.typesSource ??
      'export interface ExampleProps { value?: string; defaultValue?: string; disabled?: boolean; loading?: boolean; onValueChange?: (value: string) => void; }\n'
  );
  fs.writeFileSync(
    path.join(componentDir, 'Example.tsx'),
    params.implementationSource ??
      "import type { ExampleProps } from './types';\nexport function Example(props: ExampleProps) { const disabled = props.disabled; const loading = props.loading; return null; }\n"
  );

  if (
    params.rootTypesSource !== undefined ||
    params.rootImplementationSource !== undefined
  ) {
    const rootDir = path.join(componentDir, 'Root');
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, 'types.ts'),
      params.rootTypesSource ??
        "import type { ExampleProps } from '../types';\nexport type ExampleRootProps = ExampleProps;\n"
    );
    fs.writeFileSync(
      path.join(rootDir, 'ExampleRoot.tsx'),
      params.rootImplementationSource ??
        "import type { ExampleRootProps } from './types';\nexport function ExampleRoot(_props: ExampleRootProps) { return null; }\n"
    );
    fs.writeFileSync(
      path.join(rootDir, 'index.ts'),
      "export { ExampleRoot } from './ExampleRoot';\nexport type { ExampleRootProps } from './types';\n"
    );
  }

  if (params.sharedTypeSource !== undefined) {
    const sharedDir = path.join(root, 'packages', 'types', 'src');
    fs.mkdirSync(sharedDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharedDir, 'example.ts'),
      params.sharedTypeSource
    );
    fs.writeFileSync(
      path.join(sharedDir, 'index.ts'),
      params.sharedBarrelSource ?? "export * from './example';\n"
    );
  }

  vi.spyOn(process, 'cwd').mockReturnValue(root);

  return {
    root,
    componentDir,
    metadata: params.metadataOverride ?? metadata,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('API/feature quality rules', () => {
  it('passes a valid public API surface', async () => {
    createComponent({});

    const result = await publicApiSurfaceRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('passes a compound public API tied through a Root alias', async () => {
    createComponent({
      typesSource:
        "import type { ExampleRootProps } from './Root';\nexport type ExampleProps = ExampleRootProps;\n",
      implementationSource:
        "import { ExampleRoot } from './Root';\nexport const Example = Object.assign(ExampleRoot, {});\n",
      rootTypesSource:
        "import type { BaseExampleProps } from '@vellira-ui/types';\nexport type ExampleRootProps = BaseExampleProps;\n",
    });

    const result = await publicApiSurfaceRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('fails when the public Props contract is missing', async () => {
    createComponent({ typesSource: 'export type SomethingElse = string;\n' });

    const result = await publicApiSurfaceRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('ExampleProps');
  });

  it('rejects an orphan Props export unrelated to the callable component', async () => {
    createComponent({
      implementationSource:
        'type LocalProps = { value?: string };\nexport function Example(_props: LocalProps) { return null; }\n',
    });

    const result = await publicApiSurfaceRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('callable/root');
  });

  it.each([
    '// ExampleProps\n',
    'const marker = "ExampleProps";\n',
    "import type { ExampleProps } from './types';\n",
    "import type { ExampleProps } from './types';\nfunction unrelated(_props: ExampleProps) {}\n",
    'interface ExampleProps { count: number }\n',
  ])(
    'rejects unrelated canonical names outside the exported callable: %s',
    async (decoy) => {
      createComponent({
        implementationSource:
          decoy +
          'type LocalProps = { count: number }; export function Example(props: LocalProps) { return props.count; }',
      });
      const result = await publicApiSurfaceRule.evaluate({
        metadata,
        platform: 'react',
      });
      expect(result.status).toBe('fail');
    }
  );

  it('rejects a locally redeclared Props type despite its matching spelling', async () => {
    createComponent({
      implementationSource:
        'interface ExampleProps { count: number }; export function Example(props: ExampleProps) { return props.count; }',
    });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
  });

  it.each([
    "export type { Example } from './Example';",
    "export type * from './Example';",
    "export { type Example } from './Example';",
    "import type { Example } from './Example'; export { Example };",
  ])('rejects erased type-only component exports: %s', async (indexSource) => {
    createComponent({ indexSource });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
  });

  it.each(['react', 'react-native'] as const)(
    'follows runtime barrels without accepting erased exports on %s',
    async (platform) => {
      const { componentDir } = createComponent({
        platform,
        indexSource: "export * from './barrel';",
      });
      const barrel = path.join(componentDir, 'barrel.ts');
      fs.writeFileSync(barrel, "export { Example } from './Example';");
      expect(
        (await publicApiSurfaceRule.evaluate({ metadata, platform })).status
      ).toBe('pass');
      fs.writeFileSync(barrel, "export type * from './Example';");
      expect(
        (await publicApiSurfaceRule.evaluate({ metadata, platform })).status
      ).toBe('fail');
    }
  );

  it('does not treat a value named Props as a type contract', async () => {
    createComponent({ typesSource: 'export const ExampleProps = {};' });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
  });

  it('requires an actual public export and exported Props declaration', async () => {
    createComponent({ indexSource: '// export { Example };\n' });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
    createComponent({
      typesSource:
        '// export interface ExampleProps {}\nexport interface OtherProps { value: string }',
    });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
  });

  it.each([
    "import type { ExampleProps as Props } from './types'; export const Example = (props: Props) => null;",
    "import {forwardRef as forward} from 'react'; import type {ExampleProps} from './types'; export const Example=forward<unknown,ExampleProps>((props,ref)=>null);",
    "import React from 'react'; import type {ExampleProps} from './types'; export const Example=React.memo((props:ExampleProps)=>null);",
    "import type {FC} from 'react'; import type {ExampleProps} from './types'; export const Example:FC<ExampleProps>=(props)=>null;",
    "import * as R from 'react'; import type {ExampleProps} from './types'; export const Example:R.FunctionComponent<ExampleProps>=(props)=>null;",
  ])(
    'preserves explicit aliases and canonical React callable wrappers: %s',
    async (implementationSource) => {
      createComponent({ implementationSource });
      expect(
        (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
          .status
      ).toBe('pass');
    }
  );

  it.each(['any', 'unknown', '(props: { count: number }) => unknown'])(
    'rejects an export annotation that erases the canonical callable: %s',
    async (annotation) => {
      createComponent({
        implementationSource: `import type {ExampleProps} from './types'; export const Example: ${annotation} = (props:ExampleProps)=>null;`,
      });
      expect(
        (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
          .status
      ).toBe('fail');
    }
  );

  it('accepts an explicit function annotation using the canonical Props', async () => {
    createComponent({
      implementationSource:
        "import type {ExampleProps} from './types'; export const Example: (props: ExampleProps)=>unknown = (props)=>null;",
    });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('pass');
  });

  it('rejects a locally shadowed React wrapper', async () => {
    createComponent({
      implementationSource:
        "import type {ExampleProps} from './types'; const forwardRef=(_callback:unknown)=>'unrelated'; export const Example=forwardRef<unknown,ExampleProps>((props)=>null);",
    });
    expect(
      (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
        .status
    ).toBe('fail');
  });

  it.each([
    "import type {forwardRef} from 'react'; import type {ExampleProps} from './types'; export const Example=forwardRef<unknown,ExampleProps>((props)=>null);",
    "import type {ExampleProps} from './types'; const unrelated=(props:ExampleProps)=>null; export const Example='placeholder';",
    "import type {ExampleProps} from './types'; const Object={assign:()=> 'placeholder'}; export const Example=Object.assign((props:ExampleProps)=>null,{});",
  ])(
    'rejects non-callable exports or forged runtime bindings: %s',
    async (implementationSource) => {
      createComponent({ implementationSource });
      expect(
        (await publicApiSurfaceRule.evaluate({ metadata, platform: 'react' }))
          .status
      ).toBe('fail');
    }
  );

  it('validates every maintained Web and Native API surface', async () => {
    const rootDir = fileURLToPath(new URL('../../../../', import.meta.url));
    let checked = 0;
    for (const component of componentMetadata) {
      for (const platform of component.platforms) {
        const result = await publicApiSurfaceRule.evaluate({
          metadata: component,
          platform,
          rootDir,
        });
        expect(
          result.status,
          `${component.name}/${platform}: ${result.message ?? ''}`
        ).toBe('pass');
        checked += 1;
      }
    }
    expect(checked).toBe(
      componentMetadata.reduce(
        (sum, component) => sum + component.platforms.length,
        0
      )
    );
    expect(checked).toBeGreaterThan(0);
  });

  it('passes canonical shared ownership without imposing a Base<Name>Props symbol', async () => {
    const sharedMetadata: ComponentMetadata = {
      ...metadata,
      dependencies: {
        packages: ['@vellira-ui/types'],
      },
    };

    createComponent({
      metadataOverride: sharedMetadata,
      typesSource:
        "import type { ExampleBaseProps } from '@vellira-ui/types';\nexport type ExampleProps = ExampleBaseProps;\n",
      sharedTypeSource:
        'export interface ExampleBaseProps { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; }\n',
    });

    const result = await sharedTypeContractRule.evaluate({
      metadata: sharedMetadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('does not mistake shared helper types for required component parts', async () => {
    const sharedMetadata: ComponentMetadata = {
      ...metadata,
      dependencies: {
        packages: ['@vellira-ui/types'],
      },
    };

    createComponent({
      metadataOverride: sharedMetadata,
      typesSource:
        "import type { BaseExampleSharedProps } from '@vellira-ui/types';\nexport type ExampleProps = BaseExampleSharedProps;\n",
      sharedTypeSource:
        'export interface BaseExampleSharedProps { value?: string; }\nexport interface BaseExampleSingleProps { value?: string; }\n',
    });

    const result = await sharedTypeContractRule.evaluate({
      metadata: sharedMetadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('fails shared ownership when the canonical file is missing', async () => {
    const sharedMetadata: ComponentMetadata = {
      ...metadata,
      dependencies: {
        packages: ['@vellira-ui/types'],
      },
    };

    createComponent({
      metadataOverride: sharedMetadata,
      typesSource:
        "import type { BaseExampleProps } from '@vellira-ui/types';\nexport type ExampleProps = BaseExampleProps;\n",
    });

    const result = await sharedTypeContractRule.evaluate({
      metadata: sharedMetadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('canonical shared type module');
  });

  it('fails when a canonical shared module exists but metadata omits the dependency', async () => {
    createComponent({
      typesSource:
        "import type { BaseExampleProps } from '@vellira-ui/types';\nexport type ExampleProps = BaseExampleProps;\n",
      sharedTypeSource:
        'export interface BaseExampleProps { value?: string; }\n',
    });

    const result = await sharedTypeContractRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('metadata dependency');
  });

  it('fails shared ownership when a renderer independently redeclares props', async () => {
    const sharedMetadata: ComponentMetadata = {
      ...metadata,
      dependencies: {
        packages: ['@vellira-ui/types'],
      },
    };

    createComponent({
      metadataOverride: sharedMetadata,
      sharedTypeSource:
        'export interface BaseExampleProps { value?: string; }\n',
    });

    const result = await sharedTypeContractRule.evaluate({
      metadata: sharedMetadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('renderer derivation/import');
  });

  it('checks controlled and uncontrolled contracts only when declared', async () => {
    createComponent({});

    const result = await controlledContractRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('fails when a declared controlled contract has no source evidence', async () => {
    createComponent({
      typesSource: 'export interface ExampleProps { disabled?: boolean; }\n',
    });

    const result = await controlledContractRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('controlled');
  });

  it('does not penalize controlled behavior when it is not applicable', async () => {
    createComponent({});
    const withoutControlled: ComponentMetadata = {
      ...metadata,
      capabilities: ['disabled'],
    };

    const result = await controlledContractRule.evaluate({
      metadata: withoutControlled,
      platform: 'react',
    });

    expect(result.status).toBe('not-applicable');
  });

  it('passes declared deterministic state capabilities', async () => {
    createComponent({});

    const result = await declaredCapabilitiesRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('pass');
  });

  it('reports implementation drift for a declared capability', async () => {
    createComponent({
      typesSource:
        'export interface ExampleProps { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; }\n',
      implementationSource:
        "import type { ExampleProps } from './types';\nexport function Example(_props: ExampleProps) { return null; }\n",
    });

    const result = await declaredCapabilitiesRule.evaluate({
      metadata,
      platform: 'react',
    });

    expect(result.status).toBe('fail');
    expect(result.message).toContain('disabled');
    expect(result.message).toContain('loading');
  });
});
