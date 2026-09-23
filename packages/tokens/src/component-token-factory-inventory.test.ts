import { describe, expect, it } from 'vitest';

import {
  type ComponentFactoryInventoryInput,
  validateComponentFactoryInventory,
} from './component-token-factory-inventory.js';

const factory = (name: string) => ({
  name,
  source: `packages/tokens/src/factories/components/${name}.ts`,
});

function fixture(): ComponentFactoryInventoryInput {
  return {
    historicalNames: ['createButtonTokens'],
    generated: [factory('createNoticeTokens')],
    maintained: [factory('createButtonTokens'), factory('createNoticeTokens')],
    files: [
      { name: 'createButtonTokens.ts', regularFile: true },
      { name: 'createNoticeTokens.ts', regularFile: true },
    ],
  };
}

describe('component factory inventory validation', () => {
  it('accepts historical factories with an empty generated authority', () => {
    const input = fixture();
    expect(
      validateComponentFactoryInventory({
        ...input,
        generated: [],
        maintained: input.maintained.slice(0, 1),
        files: input.files.slice(0, 1),
      })
    ).toEqual([]);
  });

  it('accepts generated factories without a per-component allowlist', () => {
    expect(validateComponentFactoryInventory(fixture())).toEqual([]);
  });

  it('accepts another generated component and ignores inventory order', () => {
    const input = fixture();
    const next = factory('createBannerTokens');
    expect(
      validateComponentFactoryInventory({
        ...input,
        generated: [next, ...input.generated],
        maintained: [...input.maintained, next].reverse(),
        files: [
          { name: `${next.name}.ts`, regularFile: true },
          ...input.files,
        ].reverse(),
      })
    ).toEqual([]);
  });

  const invalidCases: Array<{
    name: string;
    change: (
      input: ComponentFactoryInventoryInput
    ) => ComponentFactoryInventoryInput;
    finding: string;
  }> = [
    {
      name: 'missing historical maintained entry',
      change: (input) => ({ ...input, maintained: input.maintained.slice(1) }),
      finding: 'maintained inventory differs from authority',
    },
    {
      name: 'missing generated maintained entry',
      change: (input) => ({
        ...input,
        maintained: input.maintained.slice(0, 1),
      }),
      finding: 'maintained inventory differs from authority',
    },
    {
      name: 'unregistered maintained entry',
      change: (input) => ({
        ...input,
        maintained: [...input.maintained, factory('createOrphanTokens')],
      }),
      finding: 'maintained inventory differs from authority',
    },
    {
      name: 'duplicate generated registration',
      change: (input) => ({
        ...input,
        generated: [...input.generated, ...input.generated],
      }),
      finding: 'authority: duplicate name createNoticeTokens',
    },
    {
      name: 'generated collision with the historical baseline',
      change: (input) => ({
        ...input,
        generated: [...input.generated, factory('createButtonTokens')],
      }),
      finding: 'authority: duplicate name createButtonTokens',
    },
    {
      name: 'duplicate maintained entry',
      change: (input) => ({
        ...input,
        maintained: [...input.maintained, ...input.generated],
      }),
      finding: 'maintained: duplicate name createNoticeTokens',
    },
    {
      name: 'generated source drift',
      change: (input) => ({
        ...input,
        generated: [{ name: 'createNoticeTokens', source: '../wrong.ts' }],
      }),
      finding: 'authority: noncanonical source for createNoticeTokens',
    },
    {
      name: 'maintained source drift',
      change: (input) => ({
        ...input,
        maintained: input.maintained.map((entry) => ({
          ...entry,
          source: '../wrong.ts',
        })),
      }),
      finding: 'maintained: noncanonical source for createNoticeTokens',
    },
    {
      name: 'source collision',
      change: (input) => ({
        ...input,
        generated: [
          ...input.generated,
          { ...factory('createNoticeTokens'), name: 'createOtherTokens' },
        ],
      }),
      finding:
        'authority: duplicate source packages/tokens/src/factories/components/createNoticeTokens.ts',
    },
    {
      name: 'missing physical factory',
      change: (input) => ({ ...input, files: input.files.slice(0, 1) }),
      finding: 'factory files differ from authority',
    },
    {
      name: 'orphan physical factory',
      change: (input) => ({
        ...input,
        files: [
          ...input.files,
          { name: 'createOrphanTokens.ts', regularFile: true },
        ],
      }),
      finding: 'factory files differ from authority',
    },
    {
      name: 'directory or symlink masquerading as a factory',
      change: (input) => ({
        ...input,
        files: input.files.map((file) => ({ ...file, regularFile: false })),
      }),
      finding: 'factory entry is not a regular file: createNoticeTokens.ts',
    },
    {
      name: 'noncanonical generated factory name',
      change: (input) => ({
        ...input,
        generated: [factory('notice')],
        maintained: [factory('createButtonTokens'), factory('notice')],
        files: [
          ...input.files.slice(0, 1),
          { name: 'notice.ts', regularFile: true },
        ],
      }),
      finding: 'authority: invalid factory name notice',
    },
    {
      name: 'palette helper registered as a full component factory',
      change: (input) => ({
        ...input,
        generated: [factory('createNoticePaletteTokens')],
      }),
      finding: 'authority: invalid factory name createNoticePaletteTokens',
    },
    {
      name: 'unregistered non-TypeScript entry',
      change: (input) => ({
        ...input,
        files: [...input.files, { name: 'extra.js', regularFile: true }],
      }),
      finding: 'unexpected factory entry: extra.js',
    },
  ];

  it.each(invalidCases)('rejects $name', ({ change, finding }) => {
    expect(validateComponentFactoryInventory(change(fixture()))).toContain(
      finding
    );
  });

  it('rejects a historical deletion from both observations', () => {
    const input = fixture();
    const findings = validateComponentFactoryInventory({
      ...input,
      maintained: input.maintained.slice(1),
      files: input.files.slice(1),
    });
    expect(findings).toContain('maintained inventory differs from authority');
    expect(findings).toContain('factory files differ from authority');
  });
});
