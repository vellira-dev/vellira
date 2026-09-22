import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateApiDocs, section } from './generate-api-docs';

import type { ApiSection } from './generate-api-docs';

const roots: string[] = [];

function createApiFixture(
  files: Record<string, string>,
  sections: ApiSection[]
) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-api-docs-determinism-')
  );
  roots.push(root);

  for (const [relativePath, source] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source);
  }

  const sectionsByDoc = new Map<string, ApiSection[]>();

  for (const item of sections) {
    sectionsByDoc.set(item.docPath, [
      ...(sectionsByDoc.get(item.docPath) ?? []),
      item,
    ]);
  }

  for (const [docPath, docSections] of sectionsByDoc) {
    const filePath = path.join(root, docPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      `# API\n\n${docSections
        .map(
          (item) =>
            `${item.heading}\n\n<!-- api-docgen:start ${item.id} -->\n| Prop | Type | Required | Description |\n| ---- | ---- | -------- | ----------- |\n| \`placeholder\` | \`never\` | No | — |\n<!-- api-docgen:end ${item.id} -->`
        )
        .join('\n\n')}\n`
    );
  }

  return root;
}

function readGeneratedBlock(root: string, item: ApiSection) {
  const source = fs.readFileSync(path.join(root, item.docPath), 'utf8');
  const startMarker = `<!-- api-docgen:start ${item.id} -->`;
  const endMarker = `<!-- api-docgen:end ${item.id} -->`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  return source.slice(start, end + endMarker.length);
}

afterEach(() => {
  vi.restoreAllMocks();

  for (const root of roots.splice(0)) {
    fs.rmSync(root, {
      recursive: true,
      force: true,
    });
  }
});

describe('generateApiDocs silent library mode', () => {
  it('updates docs without writing informational output to stdout or stderr', async () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-api-docs-silent-')
    );

    roots.push(root);

    const typesFile = path.join(root, 'packages/react/src/Test/types.ts');
    const apiFile = path.join(root, 'packages/react/API.md');

    fs.mkdirSync(path.dirname(typesFile), {
      recursive: true,
    });

    fs.writeFileSync(
      typesFile,
      `export interface TestProps {
  value?: string;
}
`
    );

    fs.writeFileSync(
      apiFile,
      `# React API

## Test

<!-- api-docgen:start web.TestProps.Test -->
| Prop | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| \`value\` | \`number\` | No | Old description |
<!-- api-docgen:end web.TestProps.Test -->
`
    );

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await generateApiDocs({
      rootDir: root,
      silent: true,
      sections: [section('web', '## Test', 'TestProps', 'src/Test/types.ts')],
    });

    expect(result.status).toBe('updated');
    expect(result.changedFiles).toEqual(['packages/react/API.md']);

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    expect(fs.readFileSync(apiFile, 'utf8')).toContain('`value`');
  });
});

it('preserves informational output by default', async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-api-docs-default-output-')
  );

  roots.push(root);

  const typesFile = path.join(root, 'packages/react/src/Test/types.ts');
  const apiFile = path.join(root, 'packages/react/API.md');

  fs.mkdirSync(path.dirname(typesFile), {
    recursive: true,
  });

  fs.writeFileSync(
    typesFile,
    `export interface TestProps {
  value?: string;
}
`
  );

  fs.writeFileSync(
    apiFile,
    `# React API

## Test

<!-- api-docgen:start web.TestProps.Test -->
| Prop | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| \`value\` | \`number\` | No | Old description |
<!-- api-docgen:end web.TestProps.Test -->
`
  );

  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await generateApiDocs({
    rootDir: root,
    sections: [section('web', '## Test', 'TestProps', 'src/Test/types.ts')],
  });

  expect(log).toHaveBeenCalledWith('Updated packages/react/API.md');
});

it('documents props from every branch of a discriminated union type', async () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-api-docs-union-')
  );

  roots.push(root);

  const typesFile = path.join(root, 'packages/react/src/Test/types.ts');
  const apiFile = path.join(root, 'packages/react/API.md');

  fs.mkdirSync(path.dirname(typesFile), {
    recursive: true,
  });

  fs.writeFileSync(
    typesFile,
    `export type TestProps =
  | {
      children?: string;
      type?: 'single';
      value?: string;
      onValueChange?: (value: string) => void;
      collapsible?: boolean;
    }
  | {
      children?: string;
      type: 'multiple';
      value?: string[];
      onValueChange?: (value: string[]) => void;
      collapsible?: never;
    };
`
  );

  fs.writeFileSync(
    apiFile,
    `# React API

## Test

<!-- api-docgen:start web.TestProps.Test -->
| Prop | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| \`children\` | \`string\` | No | Content |
<!-- api-docgen:end web.TestProps.Test -->
`
  );

  await generateApiDocs({
    rootDir: root,
    silent: true,
    sections: [section('web', '## Test', 'TestProps', 'src/Test/types.ts')],
  });

  const result = fs.readFileSync(apiFile, 'utf8');

  expect(result).toContain("`'multiple' \\| 'single'`");
  expect(result).toContain('`string \\| string[]`');
  expect(result).toContain(
    '`((value: string) => void) \\| ((value: string[]) => void)`'
  );
  expect(result).toContain('`collapsible`');
});

describe('deterministic semantic type serialization', () => {
  const targetSection = section(
    'web',
    '## Target',
    'TargetProps',
    'src/Target/types.ts'
  );
  const choiceSection = section(
    'web',
    '## Choice',
    'ChoiceProps',
    'src/Target/types.ts'
  );
  const earlierSection = section(
    'web',
    '## Earlier',
    'EarlierProps',
    'src/Earlier/types.ts'
  );
  const laterSection = section(
    'web',
    '## Later',
    'LaterProps',
    'src/Later/types.ts'
  );
  const fixtureFiles = {
    'packages/react/src/Target/types.ts': `export type SharedState =
  | 'shared-z'
  | 'shared-a';

export type Maybe<T> = T | null;

export interface InheritedProps {
  inherited: 'inherited-z' | 'inherited-a';
}

export interface TargetProps extends InheritedProps {
  announcement?: 'off' | 'polite' | 'assertive';
  mixed: 2 | 'two' | 1 | 'one';
  optional?: 'enabled' | 'disabled' | undefined;
  shared: SharedState;
  genericAlias: Maybe<'enabled' | 'disabled'>;
  callback?: (mode: 'off' | 'polite') => void;
  nested: Promise<'off' | 'assertive'>;
  tuple: readonly ['off' | 'polite', number | null];
  nullable: null | 'value';
  method(mode: 'off' | 'polite'): 'yes' | 'no';
}

export type ChoiceProps =
  | {
      mode: 'single';
      value?: 'off' | 'polite';
      onChange?: (value: 'off' | 'polite') => void;
      nested?: Promise<'off' | 'polite'>;
    }
  | {
      mode: 'multiple';
      value?: number[];
      onChange?: (value: 'off' | 'assertive') => void;
      nested?: Promise<'off' | 'assertive'>;
    };
`,
    'packages/react/src/Earlier/types.ts': `export interface EarlierProps {
  seed: 'assertive' | 'off' | 'polite';
  nested: Promise<'assertive' | 'polite' | 'off'>;
}
`,
    'packages/react/src/Later/types.ts': `export interface LaterProps {
  seed: 'polite' | 'assertive' | 'off';
  callback: (mode: 'polite' | 'off' | 'assertive') => void;
}
`,
  };
  const allSections = [
    earlierSection,
    laterSection,
    targetSection,
    choiceSection,
  ];

  it('renders the same target bytes for target-only and reordered multi-file Programs', async () => {
    const targetOnlyRoot = createApiFixture(fixtureFiles, allSections);
    const earlierFirstRoot = createApiFixture(fixtureFiles, allSections);
    const laterFirstRoot = createApiFixture(fixtureFiles, allSections);

    await generateApiDocs({
      rootDir: targetOnlyRoot,
      silent: true,
      sections: [targetSection],
    });
    await generateApiDocs({
      rootDir: earlierFirstRoot,
      silent: true,
      sections: [earlierSection, laterSection, targetSection],
    });
    await generateApiDocs({
      rootDir: laterFirstRoot,
      silent: true,
      sections: [laterSection, earlierSection, targetSection],
    });

    const targetOnly = readGeneratedBlock(targetOnlyRoot, targetSection);

    expect(readGeneratedBlock(earlierFirstRoot, targetSection)).toBe(
      targetOnly
    );
    expect(readGeneratedBlock(laterFirstRoot, targetSection)).toBe(targetOnly);
    expect(targetOnly).toContain("`'assertive' \\| 'off' \\| 'polite'`");
    expect(targetOnly).toContain("`'one' \\| 'two' \\| 1 \\| 2`");
    expect(targetOnly).toContain("`'disabled' \\| 'enabled'`");
    expect(targetOnly).not.toContain("'disabled' \\| undefined");
    expect(targetOnly).toContain('`SharedState`');
    expect(targetOnly).toContain("`Maybe<'disabled' \\| 'enabled'>`");
    expect(targetOnly).toContain("`(mode: 'off' \\| 'polite') => void`");
    expect(targetOnly).toContain(
      "`(mode: 'off' \\| 'polite') => 'no' \\| 'yes'`"
    );
    expect(targetOnly).toContain("`Promise<'assertive' \\| 'off'>`");
    expect(targetOnly).toContain(
      "`readonly ['off' \\| 'polite', null \\| number]`"
    );
    expect(targetOnly).toContain("`'value' \\| null`");
    expect(targetOnly).toContain("`'inherited-a' \\| 'inherited-z'`");
  });

  it('keeps global generation and plan-scoped checks byte-identical in both directions', async () => {
    const globalFirstRoot = createApiFixture(fixtureFiles, allSections);

    await generateApiDocs({
      rootDir: globalFirstRoot,
      silent: true,
      sections: [earlierSection, laterSection, targetSection],
    });

    expect(
      await generateApiDocs({
        rootDir: globalFirstRoot,
        check: true,
        silent: true,
        sections: [targetSection],
      })
    ).toMatchObject({ status: 'up-to-date', changedFiles: [] });

    const scopedFirstRoot = createApiFixture(fixtureFiles, allSections);

    await generateApiDocs({
      rootDir: scopedFirstRoot,
      silent: true,
      sections: [laterSection, earlierSection],
    });
    await generateApiDocs({
      rootDir: scopedFirstRoot,
      silent: true,
      sections: [targetSection],
    });

    expect(
      await generateApiDocs({
        rootDir: scopedFirstRoot,
        check: true,
        silent: true,
        sections: [targetSection, earlierSection, laterSection],
      })
    ).toMatchObject({ status: 'up-to-date', changedFiles: [] });
  });

  it('aggregates branch property unions without flattening nested function or generic unions', async () => {
    const root = createApiFixture(fixtureFiles, allSections);

    await generateApiDocs({
      rootDir: root,
      silent: true,
      sections: [choiceSection],
    });

    const result = readGeneratedBlock(root, choiceSection);

    expect(result).toContain("`'multiple' \\| 'single'`");
    expect(result).toContain("`'off' \\| 'polite' \\| number[]`");
    expect(result).toContain(
      "`((value: 'assertive' \\| 'off') => void) \\| ((value: 'off' \\| 'polite') => void)`"
    );
    expect(result).toContain(
      "`Promise<'assertive' \\| 'off'> \\| Promise<'off' \\| 'polite'>`"
    );
  });
});
