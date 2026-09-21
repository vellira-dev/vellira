import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import type { ComponentTokenContract } from '@vellira-ui/metadata';

import {
  getGeneratedComponentTokenLeafSuffixes,
  getGeneratedComponentTokenLogicalPaths,
} from './component-token-logical-paths';
import { renderComponentTokenFactoryTemplate } from './templates';

function collectLeafPaths(
  value: unknown,
  prefix = '',
  result: string[] = []
): string[] {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectLeafPaths(child, prefix ? `${prefix}.${key}` : key, result);
    }
    return result;
  }

  result.push(prefix);
  return result;
}

async function generatedTokenShape(componentTokens: ComponentTokenContract) {
  const source = renderComponentTokenFactoryTemplate({
    componentName: 'EvidenceProbe',
    componentTokens,
  });
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = (await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`
  )) as Record<string, (value: unknown) => unknown>;
  const createFromSemantics = module.createEvidenceProbeTokensFromSemantics;

  if (!createFromSemantics) {
    throw new Error('Generated factory did not export its semantic adapter.');
  }

  if (componentTokens === 'disclosure') {
    return createFromSemantics({
      border: { muted: 'border' },
      focus: { ring: { color: 'focus' } },
      surface: {
        default: 'default',
        subtle: 'subtle',
        hover: 'hover',
        pressed: 'pressed',
        disabled: 'disabled',
      },
      text: {
        primary: 'primary',
        secondary: 'secondary',
        disabled: 'disabled-text',
      },
    });
  }

  return createFromSemantics({
    control: {
      default: { bg: 'default-bg', border: 'default-border', fg: 'default-fg' },
      hover: { bg: 'hover-bg', border: 'hover-border', fg: 'hover-fg' },
      pressed: {
        bg: 'pressed-bg',
        border: 'pressed-border',
        fg: 'pressed-fg',
      },
      selected: {
        default: { bg: 'on-bg', border: 'on-border', fg: 'on-fg' },
        hover: {
          bg: 'on-hover-bg',
          border: 'on-hover-border',
          fg: 'on-hover-fg',
        },
        pressed: {
          bg: 'on-pressed-bg',
          border: 'on-pressed-border',
          fg: 'on-pressed-fg',
        },
      },
      disabled: {
        bg: 'disabled-bg',
        border: 'disabled-border',
        fg: 'disabled-fg',
      },
    },
    focus: { ring: { color: 'focus' } },
    status: {
      error: { fg: 'error-fg', border: 'error-border', ring: 'error-ring' },
    },
  });
}

describe('generated component-token logical paths', () => {
  it.each<ComponentTokenContract>([
    'standard',
    'boolean-control',
    'disclosure',
  ])('matches the actual %s Generator V2 token shape', async (contract) => {
    const shape = await generatedTokenShape(contract);
    const actual = collectLeafPaths(shape).sort((left, right) =>
      left.localeCompare(right, 'en')
    );
    const authority = [
      ...getGeneratedComponentTokenLeafSuffixes(contract),
    ].sort((left, right) => left.localeCompare(right, 'en'));

    expect(authority).toEqual(actual);
    expect(
      getGeneratedComponentTokenLogicalPaths({
        componentName: 'EvidenceProbe',
        componentTokens: contract,
      })
    ).toEqual(authority.map((suffix) => `components.evidenceProbe.${suffix}`));
  });
});
