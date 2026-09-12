import type { FindingInput, RuleResult } from './contract';
import { checkTokenCssReferences } from './css-repository';

/**
 * Final #890 coverage policy for maintained CSS/SCSS consumers.
 *
 * The repository intentionally supports a bounded static Sass grammar rather
 * than embedding a general Sass evaluator. Anything outside the statically
 * proven grammar/provider model remains visible as a finding and is promoted
 * to an error here, so unsupported interpolation, escaped identifiers,
 * symlinks, ambiguous component providers, and unknown external providers can
 * never become an unscanned warning once this rule is marked complete.
 */
export function enforceCompleteConsumerReferenceCoverage(
  result: RuleResult
): RuleResult {
  const findings: FindingInput[] = result.findings.map((finding) =>
    finding.severity === 'warning'
      ? {
          ...finding,
          severity: 'error',
          expected:
            `${finding.expected} Complete consumer-reference coverage requires every maintained reference/provider boundary to be statically proven.`,
          suggestedAction:
            `${finding.suggestedAction} Unsupported or ambiguous CSS/Sass/provider syntax must be made statically provable before merging.`,
        }
      : finding
  );

  return {
    coverage: 'complete',
    scope:
      'Complete maintained CSS/SCSS consumer coverage: canonical generated variables, local/runtime/component/application/Shiki provider ownership, and bounded Sass list/@each/mixin expansion are statically proven. General Sass evaluation is deliberately out of scope; any unsupported interpolation/escape, source symlink, ambiguous provider boundary, or unclassified external variable fails closed as an error instead of leaving partial coverage.',
    checked: result.checked,
    findings,
  };
}

export function checkTokenCssReferencesComplete(root: string): RuleResult {
  return enforceCompleteConsumerReferenceCoverage(
    checkTokenCssReferences(root)
  );
}
