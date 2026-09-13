import { serializeCssTokenValue } from '../../../packages/tokens/scripts/token-css-output';
import { isComponentPlatformIntent } from '../../../packages/tokens/src/platform-output/component-token-intents';
import { resolveTokenValueKind } from '../../../packages/tokens/src/token-architecture';
import type { FindingInput, RuleResult } from './contract';

export const tokenValueKindAuditScope =
  'Canonical scalar inventory through the #881 role/serialization authority; full string-expression grammar and emitted CSS verification remain open.';

/** Inspect values without changing them or substituting fallback tokens. */
export function auditTokenValueKinds(
  value: unknown,
  tokenPrefix: string,
  theme: string | null,
  sourcePath: string
): RuleResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length === 0
  ) {
    throw new Error('A non-empty token inventory is required.');
  }
  if (!tokenPrefix.trim() || !sourcePath.trim()) {
    throw new Error('Token prefix and source identity are required.');
  }
  const findings: FindingInput[] = [];
  const ancestors = new Set<object>();
  let checked = 0;

  function invalid(
    tokenPath: string,
    code: string,
    evidence: string,
    expected: string
  ): void {
    findings.push({
      ruleId: 'tokens.value-kind',
      code,
      severity: 'error',
      sourcePath,
      tokenPath,
      line: null,
      column: null,
      layer: tokenPath.startsWith('components.')
        ? 'component'
        : tokenPath.startsWith('semantic.')
          ? 'semantic'
          : 'primitive',
      theme,
      platform: 'web',
      evidence,
      expected,
      migrationStatus: 'untracked',
      suggestedAction:
        'Repair the canonical value or its declared kind; do not bypass the serializer.',
    });
  }

  function visit(current: unknown, tokenPath: string): void {
    if (isComponentPlatformIntent(current)) {
      checked += 1;
      return;
    }
    if (typeof current === 'string' || typeof current === 'number') {
      checked += 1;
      const kind = resolveTokenValueKind(tokenPath, current);
      try {
        serializeCssTokenValue(tokenPath, current);
      } catch (error) {
        invalid(
          tokenPath,
          'invalid-token-value',
          error instanceof Error ? error.message : String(error),
          kind
            ? `A value accepted by the canonical ${kind} serializer.`
            : 'An explicit canonical kind for this numeric role.'
        );
      }
      return;
    }
    if (typeof current !== 'object' || current === null) {
      checked += 1;
      invalid(
        tokenPath,
        'unsupported-token-value',
        `Unsupported token leaf: ${current === null ? 'null' : typeof current}.`,
        'A string, number, or validated atomic platform intent.'
      );
      return;
    }
    if (ancestors.has(current)) {
      checked += 1;
      invalid(
        tokenPath,
        'cyclic-token-value',
        'The token value contains a reference to an ancestor.',
        'An acyclic serializable token inventory.'
      );
      return;
    }
    if (Object.hasOwn(current, 'kind')) {
      checked += 1;
      invalid(
        tokenPath,
        'invalid-token-intent',
        'A tagged token object does not match a canonical platform intent.',
        'An exact intent shape accepted by isComponentPlatformIntent.'
      );
      return;
    }
    const entries = Object.entries(current);
    if (entries.length === 0) {
      checked += 1;
      invalid(
        tokenPath,
        'empty-token-branch',
        'An empty token branch has no scalar or intent to validate.',
        'A non-empty canonical token branch.'
      );
      return;
    }
    ancestors.add(current);
    for (const [key, child] of entries) visit(child, `${tokenPath}.${key}`);
    ancestors.delete(current);
  }

  visit(value, tokenPrefix);
  return {
    coverage: 'partial',
    scope: tokenValueKindAuditScope,
    checked,
    findings,
  };
}
