import fs from 'node:fs';
import path from 'node:path';

import { darkTheme } from '../../../packages/tokens/src/dark/theme';
import { highContrastTheme } from '../../../packages/tokens/src/highContrast/theme';
import { lightTheme } from '../../../packages/tokens/src/light/theme';
import {
  type ComponentTokenBoundaryFinding,
  scanCanonicalComponentTokens,
} from '../../../packages/tokens/src/platform-output/component-token-boundary';
import {
  adaptComponentTokensForReactNative,
  adaptComponentTokensForWeb,
  createComponentPlatformOutputSources,
  isComponentPlatformIntent,
} from '../../../packages/tokens/src/platform-output/component-token-intents';
import type { FindingInput, RuleResult } from './contract';

const generatorTemplateRoots = [
  'scripts/generators/component/templates',
] as const;

const rendererKeyPattern =
  /(?:^|[\s{,])(?:['"]?)(web|native|reactNative|nativeMaxHeight|native[A-Z][\w$]*|reactNative[A-Z][\w$]*)(?:['"]?)\s*:/gm;

const scope =
  'Complete #884 renderer-neutral boundary: all maintained canonical component families, deterministic Web/React Native platform-output adaptation, and Generator V2 token-template source are checked. Visual/value equivalence remains owned by tokens.visual-preservation.';

function finding(
  code: string,
  sourcePath: string,
  tokenPath: string | null,
  layer: string,
  theme: string | null,
  platform: string | null,
  evidence: string,
  expected: string,
  line: number | null = null,
  column: number | null = null
): FindingInput {
  return {
    ruleId: 'tokens.platform-boundary',
    code,
    severity: 'error',
    sourcePath,
    tokenPath,
    line,
    column,
    layer,
    theme,
    platform,
    evidence,
    expected,
    migrationStatus: 'untracked',
    suggestedAction:
      'Keep canonical component tokens renderer-neutral and move representation into the shared platform-output adapters.',
  };
}

function lineAndColumn(source: string, index: number) {
  const prefix = source.slice(0, index);
  const lines = prefix.split('\n');
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function containsPlatformIntent(value: unknown): boolean {
  if (isComponentPlatformIntent(value)) return true;
  if (Array.isArray(value)) return value.some(containsPlatformIntent);
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).some(containsPlatformIntent);
}

function listGeneratorTemplateFiles(root: string): string[] {
  const files: string[] = [];

  function visit(relativePath: string) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) return;

    for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
      const child = path.posix.join(relativePath, entry.name);
      if (entry.isDirectory()) visit(child);
      else if (
        entry.isFile() &&
        entry.name.includes('token') &&
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx')
      ) {
        files.push(child);
      }
    }
  }

  for (const sourceRoot of generatorTemplateRoots) visit(sourceRoot);
  return files.sort();
}

export function auditPlatformBoundarySource(
  sourcePath: string,
  source: string
): FindingInput[] {
  const findings: FindingInput[] = [];

  for (const match of source.matchAll(rendererKeyPattern)) {
    const key = match[1]!;
    const index = (match.index ?? 0) + match[0].indexOf(key);
    const location = lineAndColumn(source, index);
    findings.push(
      finding(
        'generator-renderer-key',
        sourcePath,
        null,
        'generator',
        null,
        null,
        `Generator template declares renderer-specific canonical key "${key}".`,
        'Generator V2 canonical token templates must emit renderer-neutral contracts.',
        location.line,
        location.column
      )
    );
  }

  return findings;
}

export function auditComponentPlatformBoundary(
  components: unknown,
  theme: string,
  sourcePath: string
): RuleResult {
  if (
    typeof components !== 'object' ||
    components === null ||
    Array.isArray(components) ||
    Object.keys(components).length === 0
  ) {
    throw new Error('A non-empty component-family inventory is required.');
  }

  const violations: ComponentTokenBoundaryFinding[] = [];
  scanCanonicalComponentTokens(components, 'components', violations);
  const findings: FindingInput[] = violations.map((violation) =>
    finding(
      'renderer-specific-component-contract',
      sourcePath,
      violation.path,
      'component',
      theme,
      null,
      violation.reason,
      'Renderer-neutral keys and validated platform intents.'
    )
  );

  return {
    coverage: 'complete',
    scope,
    checked: Object.keys(components).length,
    findings,
  };
}

function auditAdaptedOutputs(
  themeName: 'light' | 'dark' | 'high-contrast',
  components: unknown
): { checked: number; findings: FindingInput[] } {
  const sources = createComponentPlatformOutputSources({ name: themeName });
  const outputs = [
    ['web', adaptComponentTokensForWeb(components, sources)],
    ['react-native', adaptComponentTokensForReactNative(components, sources)],
  ] as const;
  const findings: FindingInput[] = [];

  for (const [platform, output] of outputs) {
    if (containsPlatformIntent(output)) {
      findings.push(
        finding(
          'unresolved-platform-intent',
          'packages/tokens/src/platform-output/component-token-intents.ts',
          'components',
          'platform-output',
          themeName,
          platform,
          `A canonical platform intent survived ${platform} adaptation.`,
          'Every canonical platform intent must be resolved only after component-token resolution.'
        )
      );
    }
  }

  return { checked: outputs.length, findings };
}

export function checkTokenPlatformBoundary(root = process.cwd()): RuleResult {
  const themes = [
    ['light', 'light', lightTheme],
    ['dark', 'dark', darkTheme],
    ['high-contrast', 'highContrast', highContrastTheme],
  ] as const;
  const findings: FindingInput[] = [];
  let checked = 0;

  for (const [name, directory, theme] of themes) {
    const canonical = auditComponentPlatformBoundary(
      theme.components,
      name,
      `packages/tokens/src/${directory}/components/index.ts`
    );
    checked += canonical.checked;
    findings.push(...canonical.findings);

    const adapted = auditAdaptedOutputs(name, theme.components);
    checked += adapted.checked;
    findings.push(...adapted.findings);
  }

  const generatorFiles = listGeneratorTemplateFiles(root);
  checked += generatorFiles.length;
  for (const sourcePath of generatorFiles) {
    findings.push(
      ...auditPlatformBoundarySource(
        sourcePath,
        fs.readFileSync(path.join(root, sourcePath), 'utf8')
      )
    );
  }

  if (generatorFiles.length === 0) {
    throw new Error('Generator V2 token-template inventory must not be empty.');
  }

  return {
    coverage: 'complete',
    scope,
    checked,
    findings,
  };
}
