import fs from 'node:fs';
import path from 'node:path';

import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import {
  interactionStatePlatformContractV1,
  selectedCompoundStateGrammarV1,
} from '../../../packages/tokens/src/interaction-state-contract';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import {
  canonicalInteractionStates,
  legitimatePersistentActiveStateDomainsV1,
} from '../../../packages/tokens/src/token-architecture';
import type { FindingInput } from './contract';

const webRadioSourcePath =
  'packages/react/src/primitives/Radio/Radio.module.scss';
const nativeRadioSourcePath =
  'packages/react-native/src/primitives/Radio/Radio.tsx';

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string | null,
  layer: string,
  platform: string | null,
  evidence: string,
  expected: string
): FindingInput {
  return {
    ruleId: 'tokens.state-vocabulary',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line: null,
    column: null,
    layer,
    theme: null,
    platform,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Restore the canonical #882 compound-state/platform contract instead of inventing renderer-specific state meaning.',
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(value: unknown, tokenPath: string): unknown {
  let current = value;
  for (const segment of tokenPath.split('.')) {
    const record = asRecord(current);
    if (!record || !(segment in record)) return undefined;
    current = record[segment];
  }
  return current;
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function auditSelectedCompoundStateGrammar(): {
  checked: number;
  findings: FindingInput[];
} {
  const findings: FindingInput[] = [];
  let checked = 0;
  const sourcePath = 'packages/tokens/src/interaction-state-contract.ts';
  const grammar = selectedCompoundStateGrammarV1;
  const grammarStates = Object.keys(grammar);
  const persistentActiveDomains: readonly {
    readonly pattern: string;
    readonly meaning: string;
  }[] = legitimatePersistentActiveStateDomainsV1;

  checked += 1;
  if (!sameStrings(grammarStates, canonicalInteractionStates)) {
    findings.push(
      finding(
        'compound-state-coverage-drift',
        sourcePath,
        null,
        'semantic',
        null,
        `Selected compound grammar covers ${grammarStates.join(', ')}.`,
        `Selected composition must cover every canonical state exactly: ${canonicalInteractionStates.join(', ')}.`
      )
    );
  }

  const expectedStrategies = {
    default: 'selected-variant',
    hover: 'selected-variant',
    pressed: 'selected-variant',
    active: 'domain-specific-active',
    selected: 'selected-variant',
    disabled: 'disabled-wins',
    focus: 'orthogonal-focus',
  } as const;

  const themes = [lightTheme, darkTheme, highContrastTheme] as const;
  for (const state of canonicalInteractionStates) {
    const resolution = grammar[state];
    checked += 1;
    if (resolution.strategy !== expectedStrategies[state]) {
      findings.push(
        finding(
          'compound-state-precedence-drift',
          sourcePath,
          `selected+${state}`,
          'semantic',
          null,
          `selected+${state} uses ${resolution.strategy}.`,
          `selected+${state} must use ${expectedStrategies[state]} under Interaction State Vocabulary V1.`
        )
      );
    }

    if (resolution.semanticPath !== null) {
      for (const theme of themes) {
        checked += 1;
        if (readPath(theme, resolution.semanticPath) === undefined) {
          findings.push(
            finding(
              'compound-state-semantic-target-missing',
              sourcePath,
              resolution.semanticPath,
              'semantic',
              null,
              `${resolution.semanticPath} is missing from a maintained theme.`,
              'Every concrete compound-state target must exist in Light, Dark, and High Contrast.'
            )
          );
        }
      }
    }
  }

  checked += 1;
  if (persistentActiveDomains.length === 0) {
    findings.push(
      finding(
        'compound-active-domain-authority-missing',
        sourcePath,
        'selected+active',
        'semantic',
        null,
        'selected+active is domain-specific but no persistent active domains are registered.',
        'Domain-specific active composition requires explicit registered active-state domains.'
      )
    );
  }

  return { checked, findings };
}

export function auditPlatformInteractionStateContract(): {
  checked: number;
  findings: FindingInput[];
} {
  const findings: FindingInput[] = [];
  let checked = 0;
  const sourcePath = 'packages/tokens/src/interaction-state-contract.ts';

  for (const platform of ['web', 'react-native'] as const) {
    const mapping = interactionStatePlatformContractV1[platform];
    const states = Object.keys(mapping);
    checked += 1;
    if (!sameStrings(states, canonicalInteractionStates)) {
      findings.push(
        finding(
          'platform-state-coverage-drift',
          sourcePath,
          null,
          'platform-output',
          platform,
          `${platform} maps ${states.join(', ')}.`,
          `Every platform contract must classify all canonical states exactly: ${canonicalInteractionStates.join(', ')}.`
        )
      );
    }
  }

  const web = interactionStatePlatformContractV1.web;
  const native = interactionStatePlatformContractV1['react-native'];
  const fixedChecks = [
    {
      ok: web.hover.support === 'required' && web.hover.signal === ':hover',
      code: 'web-hover-mapping-drift',
      platform: 'web',
      evidence: JSON.stringify(web.hover),
      expected: 'Web hover must map to the pointer :hover state.',
    },
    {
      ok:
        web.pressed.support === 'required' && web.pressed.signal === ':active',
      code: 'web-pressed-mapping-drift',
      platform: 'web',
      evidence: JSON.stringify(web.pressed),
      expected:
        'Web physical press must map to :active while semantic active remains persistent/current.',
    },
    {
      ok:
        native.hover.support === 'optional' &&
        native.hover.signal === 'pointer-hover-when-capable',
      code: 'native-hover-requirement-drift',
      platform: 'react-native',
      evidence: JSON.stringify(native.hover),
      expected:
        'React Native hover must remain optional and capability-dependent.',
    },
    {
      ok:
        native.pressed.support === 'required' &&
        native.pressed.signal === 'PressableStateCallbackType.pressed',
      code: 'native-pressed-mapping-drift',
      platform: 'react-native',
      evidence: JSON.stringify(native.pressed),
      expected:
        'React Native physical press must map to PressableStateCallbackType.pressed.',
    },
    {
      ok:
        web.active.signal === 'domain-current' &&
        native.active.signal === 'domain-current',
      code: 'platform-active-meaning-drift',
      platform: null,
      evidence: `web=${web.active.signal}; react-native=${native.active.signal}`,
      expected:
        'Both platforms must reserve active for persistent/current domain state rather than physical press.',
    },
  ];

  for (const check of fixedChecks) {
    checked += 1;
    if (!check.ok) {
      findings.push(
        finding(
          check.code,
          sourcePath,
          null,
          'platform-output',
          check.platform,
          check.evidence,
          check.expected
        )
      );
    }
  }

  return { checked, findings };
}

type RendererWitness = {
  platform: 'web' | 'react-native';
  sourcePath: string;
  patterns: readonly {
    code: string;
    pattern: RegExp;
    expected: string;
  }[];
};

const rendererWitnesses: readonly RendererWitness[] = [
  {
    platform: 'web',
    sourcePath: webRadioSourcePath,
    patterns: [
      {
        code: 'web-hover-renderer-witness-missing',
        pattern: /:hover/,
        expected:
          'Web Radio must expose pointer hover independently from press.',
      },
      {
        code: 'web-pressed-renderer-witness-missing',
        pattern:
          /\.input:active:not\(:disabled\)\s*\+\s*\.control[\s\S]*?--radio-pressed-bg/,
        expected:
          'Web Radio :active must resolve the canonical pressed token family.',
      },
      {
        code: 'web-selected-pressed-witness-missing',
        pattern:
          /\.input:checked:active:not\(:disabled\)\s*\+\s*\.control[\s\S]*?--radio-selected-pressed-bg/,
        expected:
          'Web Radio selected+press must resolve selected pressed tokens.',
      },
      {
        code: 'web-selected-disabled-witness-missing',
        pattern:
          /\.input:disabled:checked\s*\+\s*\.control[\s\S]*?--radio-selected-disabled-bg/,
        expected:
          'Web Radio selected+disabled must retain disabled precedence with selected identity.',
      },
      {
        code: 'web-focus-renderer-witness-missing',
        pattern: /\.input:focus-visible\s*\+\s*\.control/,
        expected: 'Web focus must remain orthogonal to selected/pressed paint.',
      },
    ],
  },
  {
    platform: 'react-native',
    sourcePath: nativeRadioSourcePath,
    patterns: [
      {
        code: 'native-pressable-state-witness-missing',
        pattern: /PressableStateCallbackType/,
        expected:
          'React Native Radio must consume the canonical Pressable state contract.',
      },
      {
        code: 'native-pressed-renderer-witness-missing',
        pattern: /state\.pressed\s*&&\s*!resolvedDisabled/,
        expected:
          'React Native physical press must be gated by Pressable.pressed and disabled state.',
      },
      {
        code: 'native-pressed-token-witness-missing',
        pattern: /radioColor\.pressed/,
        expected:
          'React Native Pressable.pressed must resolve canonical pressed tokens.',
      },
      {
        code: 'native-selected-state-witness-missing',
        pattern: /checked:\s*resolvedChecked/,
        expected:
          'React Native selected identity must be exposed through accessibility state.',
      },
      {
        code: 'native-disabled-state-witness-missing',
        pattern: /disabled:\s*resolvedDisabled/,
        expected:
          'React Native disabled identity must be exposed through accessibility state.',
      },
      {
        code: 'native-selected-disabled-witness-missing',
        pattern: /resolvedChecked\s*&&\s*resolvedDisabled/,
        expected:
          'React Native selected+disabled presentation must be represented explicitly.',
      },
    ],
  },
];

export function auditRendererStateWitness(
  witness: RendererWitness,
  source: string
): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const rule of witness.patterns) {
    if (!rule.pattern.test(source)) {
      findings.push(
        finding(
          rule.code,
          witness.sourcePath,
          null,
          'consumer',
          witness.platform,
          `Required ${witness.platform} renderer state evidence is absent.`,
          rule.expected
        )
      );
    }
  }

  return findings;
}

export function checkTokenStateVocabularyCompletion(root: string): {
  checked: number;
  findings: FindingInput[];
} {
  const compound = auditSelectedCompoundStateGrammar();
  const platform = auditPlatformInteractionStateContract();
  const findings = [...compound.findings, ...platform.findings];
  let checked = compound.checked + platform.checked;

  for (const witness of rendererWitnesses) {
    checked += witness.patterns.length;
    const absolutePath = path.join(root, witness.sourcePath);
    if (!fs.existsSync(absolutePath)) {
      findings.push(
        finding(
          'renderer-state-witness-source-missing',
          witness.sourcePath,
          null,
          'consumer',
          witness.platform,
          `${witness.sourcePath} does not exist.`,
          'The maintained cross-platform Radio state witness must remain auditable.'
        )
      );
      continue;
    }
    findings.push(
      ...auditRendererStateWitness(
        witness,
        fs.readFileSync(absolutePath, 'utf8')
      )
    );
  }

  return { checked, findings };
}
