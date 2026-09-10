import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  allowedComponentFactoryDependencyEdgesV1,
  componentTokenDependencyAuditV1,
  componentTokenDependencyPolicyV1,
} from './component-token-dependencies.js';
import { maintainedComponentFactories } from './token-architecture.js';

const srcDir = dirname(fileURLToPath(import.meta.url));
const themes = ['light', 'dark', 'highContrast'] as const;

function readComponentSource(theme: (typeof themes)[number], file: string) {
  return readFileSync(join(srcDir, theme, 'components', file), 'utf8');
}

function factoryNameForComponent(component: string) {
  return `create${component[0]!.toUpperCase()}${component.slice(1)}Tokens`;
}

function importedComponentFactoryModules(source: string) {
  return [
    ...source.matchAll(
      /from '\.\.\/\.\.\/factories\/components\/(create[A-Z][A-Za-z0-9]*Tokens)\.js';/g
    ),
  ].map((match) => match[1]!);
}

describe('component token dependency contract', () => {
  it('audits every maintained component factory with no unresolved findings', () => {
    expect(
      componentTokenDependencyAuditV1.map(({ factory }) => factory).sort()
    ).toEqual(maintainedComponentFactories.map(({ name }) => name).sort());

    for (const entry of componentTokenDependencyAuditV1) {
      expect(entry.unresolved).toEqual([]);
    }
  });

  it('keeps primitive color usage explicit and classified in every theme', () => {
    for (const theme of themes) {
      for (const entry of componentTokenDependencyAuditV1) {
        const source = readComponentSource(theme, entry.file);
        const importsPrimitiveColors = source.includes(
          '../../primitives/colors.js'
        );
        const classifiedPrimitiveUsage = entry.primitiveColorUsage.some(
          (usage) => usage !== 'none'
        );

        expect(importsPrimitiveColors, `${theme}/${entry.file}`).toBe(
          classifiedPrimitiveUsage
        );
      }
    }
  });

  it('allows component-to-component factory reuse only through registered edges', () => {
    expect(componentTokenDependencyPolicyV1.componentToComponent.default).toBe(
      'prohibited'
    );

    for (const theme of themes) {
      for (const entry of componentTokenDependencyAuditV1) {
        const source = readComponentSource(theme, entry.file);
        const importedFactoryModules = importedComponentFactoryModules(source);

        for (const importedFactory of importedFactoryModules) {
          if (importedFactory === entry.factory) continue;

          const edge = allowedComponentFactoryDependencyEdgesV1.find(
            ({ from, to }) =>
              from === entry.component &&
              factoryNameForComponent(to) === importedFactory
          );

          expect(
            edge,
            `${theme}/${entry.file}: unregistered dependency on ${importedFactory}`
          ).toBeDefined();
        }

        const usesInputPalette = source.includes('createInputColorPalette');
        const inputPaletteEdge = allowedComponentFactoryDependencyEdgesV1.find(
          ({ from, symbol }) =>
            from === entry.component && symbol === 'createInputColorPalette'
        );

        expect(usesInputPalette, `${theme}/${entry.file}`).toBe(
          Boolean(inputPaletteEdge)
        );
      }
    }
  });

  it('does not introduce maintained-component dependencies on deprecated action semantics', () => {
    for (const theme of themes) {
      for (const entry of componentTokenDependencyAuditV1) {
        const source = readComponentSource(theme, entry.file);

        expect(source, `${theme}/${entry.file}`).not.toContain(
          '../semantic/action.js'
        );
      }
    }
  });

  it('keeps FormField presentation out of unrelated semantic roles', () => {
    const factory = readFileSync(
      join(srcDir, 'factories', 'components', 'createFormFieldTokens.ts'),
      'utf8'
    );

    expect(factory).toContain('border: presentation.labelInfoBorder');
    expect(factory).toContain('fg: presentation.requiredMarkFg');
    expect(factory).not.toContain('border: text.secondary');
  });

  it('keeps destructive clear affordances out of validation-status paint', () => {
    for (const theme of themes) {
      for (const file of ['input.ts', 'select.ts']) {
        const source = readComponentSource(theme, file);

        expect(source, `${theme}/${file}`).not.toContain(
          'hoverFg: status.error.fg'
        );
        expect(source, `${theme}/${file}`).not.toContain(
          'hoverBg: status.error.bg'
        );
        expect(source, `${theme}/${file}`).toContain('hoverFg: icons.danger');
      }
    }
  });

  it('uses the status ring role for Input validation rings', () => {
    for (const theme of themes) {
      const source = readComponentSource(theme, 'input.ts');

      expect(source, theme).toContain('ring: status.error.ring');
      expect(source, theme).not.toContain('ring: status.error.fg');
    }
  });
});
