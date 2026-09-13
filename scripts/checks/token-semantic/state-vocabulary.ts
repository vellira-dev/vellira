import fs from 'node:fs';
import path from 'node:path';

import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import {
  canonicalInteractionStates,
  canonicalTokenVocabulary,
  interactionStateVocabularyV1,
  legitimatePersistentActiveStateDomainsV1,
  maintainedComponentFactories,
} from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

const stateSourceRoots = [
  'packages/tokens/src/factories/components',
  'packages/tokens/src/light/components',
  'packages/tokens/src/dark/components',
  'packages/tokens/src/highContrast/components',
  'scripts/generators/component/templates',
] as const;

const forbiddenSourcePatterns = [
  {
    code: 'pressed-maps-to-control-active',
    pattern: /\bpressed\s*:\s*(?:[A-Za-z_$][\w$]*\.)*control\.active\b/g,
    expected: 'Transient pressed state must derive from pressed semantics.',
  },
  {
    code: 'selected-pressed-maps-to-active',
    pattern: /\bcontrol\.selected\.active\b/g,
    expected:
      'Selected transient press must use control.selected.pressed semantics.',
  },
  {
    code: 'pressed-background-maps-to-active',
    pattern: /\bpressedBg\s*:\s*(?:[A-Za-z_$][\w$]*\.)*surface\.active\b/g,
    expected: 'Pressed backgrounds must use surface.pressed semantics.',
  },
  {
    code: 'interactive-active-alias',
    pattern: /\binteractiveActive\b/g,
    expected: 'Transient interactive text state is interactivePressed.',
  },
] as const;

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string | null,
  layer: string,
  theme: string | null,
  evidence: string,
  expected: string,
  line: number | null = null,
  column: number | null = null
): FindingInput {
  return {
    ruleId: 'tokens.state-vocabulary',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line,
    column,
    layer,
    theme,
    platform: null,
    evidence,
    expected,
    migrationStatus: 'not-applicable',
    suggestedAction:
      'Restore the canonical #882 state meaning instead of aliasing pressed and active.',
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(value: unknown, segments: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of segments) {
    const record = asRecord(current);
    if (!record || !(segment in record)) return undefined;
    current = record[segment];
  }
  return current;
}

function hasPath(value: unknown, segments: readonly string[]): boolean {
  return readPath(value, segments) !== undefined;
}

function lineAndColumn(source: string, index: number) {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function listSourceFiles(root: string): string[] {
  const files: string[] = [];

  function visit(relativePath: string) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;

    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      const child = path.posix.join(relativePath, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts')
      )
        files.push(child);
    }
  }

  for (const sourceRoot of stateSourceRoots) visit(sourceRoot);
  return files.sort();
}

export function matchesActiveStateDomainPattern(
  tokenPath: string,
  pattern: string
): boolean {
  const pathSegments = tokenPath.split('.');
  const patternSegments = pattern.split('.');
  return (
    pathSegments.length === patternSegments.length &&
    patternSegments.every(
      (segment, index) => segment === '*' || segment === pathSegments[index]
    )
  );
}

export function auditStateSource(
  sourcePath: string,
  source: string
): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const rule of forbiddenSourcePatterns) {
    for (const match of source.matchAll(rule.pattern)) {
      const index = match.index ?? 0;
      const location = lineAndColumn(source, index);
      findings.push(
        finding(
          rule.code,
          sourcePath,
          null,
          sourcePath.startsWith('scripts/generators/')
            ? 'generator'
            : 'component-factory',
          null,
          `Deprecated state mapping: ${match[0]}.`,
          rule.expected,
          location.line,
          location.column
        )
      );
    }
  }

  return findings;
}

function auditTheme(
  themeName: string,
  directory: string,
  theme: unknown
): { checked: number; findings: FindingInput[] } {
  const findings: FindingInput[] = [];
  let checked = 0;
  const sourcePath = `packages/tokens/src/${directory}/theme.ts`;

  function requirePath(
    tokenPath: string,
    segments: readonly string[],
    shouldExist: boolean
  ) {
    checked += 1;
    const exists = hasPath(theme, segments);
    if (exists !== shouldExist) {
      findings.push(
        finding(
          shouldExist ? 'missing-canonical-state' : 'deprecated-state-alias',
          sourcePath,
          tokenPath,
          tokenPath.startsWith('semantic.') ? 'semantic' : 'component',
          themeName,
          shouldExist
            ? `${tokenPath} is missing.`
            : `${tokenPath} still exists.`,
          shouldExist
            ? 'The canonical state must be present.'
            : 'The deprecated active alias must be absent.'
        )
      );
    }
  }

  requirePath(
    'semantic.surface.pressed',
    ['semantic', 'surface', 'pressed'],
    true
  );
  requirePath(
    'semantic.control.pressed',
    ['semantic', 'control', 'pressed'],
    true
  );
  requirePath(
    'semantic.control.active',
    ['semantic', 'control', 'active'],
    false
  );
  requirePath(
    'semantic.control.selected.pressed',
    ['semantic', 'control', 'selected', 'pressed'],
    true
  );
  requirePath(
    'semantic.control.selected.active',
    ['semantic', 'control', 'selected', 'active'],
    false
  );
  requirePath(
    'semantic.text.interactivePressed',
    ['semantic', 'text', 'interactivePressed'],
    true
  );
  requirePath(
    'semantic.text.interactiveActive',
    ['semantic', 'text', 'interactiveActive'],
    false
  );
  requirePath(
    'semantic.menu.item.active',
    ['semantic', 'menu', 'item', 'active'],
    true
  );
  requirePath(
    'semantic.menu.item.pressed',
    ['semantic', 'menu', 'item', 'pressed'],
    true
  );
  requirePath(
    'components.select.option.active',
    ['components', 'select', 'option', 'active'],
    true
  );
  requirePath(
    'components.select.option.pressed',
    ['components', 'select', 'option', 'pressed'],
    true
  );
  requirePath(
    'components.dropdown.item.active',
    ['components', 'dropdown', 'item', 'active'],
    true
  );
  requirePath(
    'components.dropdown.item.pressed',
    ['components', 'dropdown', 'item', 'pressed'],
    true
  );
  requirePath(
    'components.tabs.primary.trigger.active',
    ['components', 'tabs', 'primary', 'trigger', 'active'],
    true
  );

  const action = asRecord(readPath(theme, ['semantic', 'action']));
  if (!action) {
    checked += 1;
    findings.push(
      finding(
        'missing-action-state-authority',
        sourcePath,
        'semantic.action',
        'semantic',
        themeName,
        'semantic.action is missing or malformed.',
        'Every action palette must expose pressed and must not expose active.'
      )
    );
  } else {
    for (const [actionName, actionValue] of Object.entries(action)) {
      const actionRecord = asRecord(actionValue);
      checked += 2;
      if (!actionRecord || !('pressed' in actionRecord)) {
        findings.push(
          finding(
            'missing-action-pressed-state',
            sourcePath,
            `semantic.action.${actionName}.pressed`,
            'semantic',
            themeName,
            `semantic.action.${actionName} has no pressed state.`,
            'Action palettes use pressed for transient activation.'
          )
        );
      }
      if (actionRecord && 'active' in actionRecord) {
        findings.push(
          finding(
            'action-active-alias',
            sourcePath,
            `semantic.action.${actionName}.active`,
            'semantic',
            themeName,
            `semantic.action.${actionName} exposes active.`,
            'Action palettes must not alias transient press to active.'
          )
        );
      }
    }
  }

  checked += 1;
  const controlPressed = readPath(theme, ['semantic', 'control', 'pressed']);
  const radioPressed = readPath(theme, ['components', 'radio', 'pressed']);
  if (JSON.stringify(radioPressed) !== JSON.stringify(controlPressed)) {
    findings.push(
      finding(
        'radio-pressed-semantic-mismatch',
        sourcePath,
        'components.radio.pressed',
        'component',
        themeName,
        'Radio pressed tokens do not resolve from semantic.control.pressed.',
        'Radio physical press must use semantic.control.pressed.'
      )
    );
  }

  const surfacePressed = readPath(theme, ['semantic', 'surface', 'pressed']);
  for (const component of ['input', 'select'] as const) {
    checked += 1;
    const pressedBg = readPath(theme, [
      'components',
      component,
      'clearButton',
      'pressedBg',
    ]);
    if (!Object.is(pressedBg, surfacePressed)) {
      findings.push(
        finding(
          'clear-button-pressed-background-mismatch',
          sourcePath,
          `components.${component}.clearButton.pressedBg`,
          'component',
          themeName,
          `Resolved pressed background does not match semantic.surface.pressed.`,
          'Clear-button physical press must derive from surface.pressed.'
        )
      );
    }
  }

  return { checked, findings };
}

export function checkTokenStateVocabulary(root: string): RuleResult {
  const findings: FindingInput[] = [];
  let checked = 0;

  checked += 1;
  if (
    JSON.stringify(canonicalTokenVocabulary.state) !==
    JSON.stringify(canonicalInteractionStates)
  ) {
    findings.push(
      finding(
        'state-authority-divergence',
        'packages/tokens/src/token-architecture.ts',
        null,
        'semantic',
        null,
        'canonicalTokenVocabulary.state diverges from canonicalInteractionStates.',
        'Both machine-readable state authorities must stay in exact lockstep.'
      )
    );
  }

  const vocabularyKeys = Object.keys(interactionStateVocabularyV1);
  checked += 1;
  if (
    JSON.stringify([...vocabularyKeys].sort()) !==
    JSON.stringify([...canonicalInteractionStates].sort())
  ) {
    findings.push(
      finding(
        'state-meaning-coverage-drift',
        'packages/tokens/src/token-architecture.ts',
        null,
        'semantic',
        null,
        'Interaction-state meanings do not cover the canonical state vocabulary exactly.',
        'Every canonical interaction state must have exactly one documented meaning.'
      )
    );
  }

  checked += 2;
  const pressedTemporality = String(
    interactionStateVocabularyV1.pressed.temporality
  );
  const activeTemporality = String(
    interactionStateVocabularyV1.active.temporality
  );
  if (pressedTemporality !== 'transient') {
    findings.push(
      finding(
        'pressed-not-transient',
        'packages/tokens/src/token-architecture.ts',
        'pressed',
        'semantic',
        null,
        `pressed temporality is ${pressedTemporality}.`,
        'pressed is transient physical pointer/key activation.'
      )
    );
  }
  if (activeTemporality === 'transient') {
    findings.push(
      finding(
        'active-collapses-to-pressed',
        'packages/tokens/src/token-architecture.ts',
        'active',
        'semantic',
        null,
        'active is documented as transient.',
        'active is persistent/current and never an alias for physical press.'
      )
    );
  }

  const activePatterns = legitimatePersistentActiveStateDomainsV1.map(
    ({ pattern }) => pattern
  );
  for (const factory of maintainedComponentFactories) {
    const componentName = factory.name
      .replace(/^create/, '')
      .replace(/Tokens$/, '');
    const family = `${componentName[0]!.toLowerCase()}${componentName.slice(1)}`;

    for (const stateKey of factory.stateKeys) {
      checked += 1;
      if (stateKey !== 'active' && !stateKey.endsWith('Active')) continue;
      const hasRegisteredActiveDomain = activePatterns.some((pattern) =>
        pattern.startsWith(`components.${family}.`)
      );
      if (!hasRegisteredActiveDomain) {
        findings.push(
          finding(
            'unregistered-active-factory-state',
            factory.source,
            `${factory.name}.${stateKey}`,
            'component-factory',
            null,
            `${factory.name} declares ${stateKey} without a registered persistent/current active domain.`,
            'Any factory active state must be justified by legitimatePersistentActiveStateDomainsV1.'
          )
        );
      }
    }
  }

  const themes = [
    ['light', 'light', lightTheme],
    ['dark', 'dark', darkTheme],
    ['high-contrast', 'highContrast', highContrastTheme],
  ] as const;
  for (const [themeName, directory, theme] of themes) {
    const result = auditTheme(themeName, directory, theme);
    checked += result.checked;
    findings.push(...result.findings);
  }

  const sourceFiles = listSourceFiles(root);
  checked += sourceFiles.length;
  for (const sourcePath of sourceFiles) {
    findings.push(
      ...auditStateSource(
        sourcePath,
        fs.readFileSync(path.join(root, sourcePath), 'utf8')
      )
    );
  }

  return {
    coverage: 'partial',
    scope:
      'Canonical #882 state authority alignment, pressed-versus-active theme contracts, registered factory active domains, and maintained component/generator source regressions. Exhaustive compound-state grammar and renderer event-to-state mapping remain to be connected.',
    checked,
    findings,
  };
}
