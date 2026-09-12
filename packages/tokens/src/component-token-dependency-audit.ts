import {
  componentTokenDependencyPolicyV1,
  semanticDependencyRepairsV1,
} from './component-token-dependencies.js';

export type ComponentDependencyTheme = 'light' | 'dark' | 'highContrast';
export type SemanticDependencyRepair =
  (typeof semanticDependencyRepairsV1)[number];

export type SemanticDependencySourceIssue = {
  code: string;
  evidence: string;
  expected: string;
};

function issue(
  code: string,
  evidence: string,
  expected: string
): SemanticDependencySourceIssue {
  return { code, evidence, expected };
}

export function auditSemanticDependencyRepairSource(input: {
  repair: SemanticDependencyRepair;
  source: string;
  theme?: ComponentDependencyTheme | null;
}): SemanticDependencySourceIssue[] {
  const findings: SemanticDependencySourceIssue[] = [];

  switch (input.repair.assertion) {
    case 'form-field-presentation': {
      if (!input.source.includes('border: presentation.labelInfoBorder')) {
        findings.push(
          issue(
            'missing-form-field-label-info-presentation',
            'FormField no longer maps labelInfo.border through component-owned presentation paint.',
            'Keep labelInfo.border on presentation.labelInfoBorder.'
          )
        );
      }
      if (!input.source.includes('fg: presentation.requiredMarkFg')) {
        findings.push(
          issue(
            'missing-form-field-required-mark-presentation',
            'FormField no longer maps requiredMark.fg through component-owned presentation paint.',
            'Keep requiredMark.fg on presentation.requiredMarkFg.'
          )
        );
      }
      if (input.source.includes('border: text.secondary')) {
        findings.push(
          issue(
            'form-field-unrelated-text-semantic',
            'FormField labelInfo.border depends on text.secondary.',
            'Component presentation paint must not borrow an unrelated text semantic role.'
          )
        );
      }
      break;
    }

    case 'clear-button-danger': {
      if (!input.theme) {
        findings.push(
          issue(
            'missing-clear-button-theme-context',
            'Clear-button repair validation was invoked without a theme.',
            'Validate clear-button semantic repair for every maintained theme.'
          )
        );
        break;
      }

      if (input.source.includes('hoverFg: status.error.fg')) {
        findings.push(
          issue(
            'clear-button-validation-fg-dependency',
            'Destructive clear-button hover foreground depends on validation status.error.fg.',
            'Use danger icon semantics or explicit component-owned presentation paint.'
          )
        );
      }
      if (input.source.includes('hoverBg: status.error.bg')) {
        findings.push(
          issue(
            'clear-button-validation-bg-dependency',
            'Destructive clear-button hover background depends on validation status.error.bg.',
            'Use explicit danger presentation paint rather than validation status paint.'
          )
        );
      }

      const expectedHoverFg =
        input.theme === 'highContrast'
          ? 'hoverFg: colors.error[400]'
          : 'hoverFg: icons.danger';
      if (!input.source.includes(expectedHoverFg)) {
        findings.push(
          issue(
            'clear-button-danger-foreground-drift',
            `Expected ${expectedHoverFg} for the ${input.theme} clear-button repair.`,
            'Preserve the accepted #888 danger foreground repair for this theme.'
          )
        );
      }
      break;
    }

    case 'input-error-ring': {
      if (!input.source.includes('ring: status.error.ring')) {
        findings.push(
          issue(
            'input-error-ring-role-drift',
            'Input validation ring no longer consumes status.error.ring.',
            'Use the dedicated status.error.ring semantic role.'
          )
        );
      }
      if (input.source.includes('ring: status.error.fg')) {
        findings.push(
          issue(
            'input-error-ring-foreground-bypass',
            'Input validation ring consumes status.error.fg.',
            'Do not substitute a value-equal foreground role for the dedicated ring role.'
          )
        );
      }
      break;
    }
  }

  return findings;
}

export function auditGeneratedThemeTokenDependencySource(
  content: string
): SemanticDependencySourceIssue[] {
  const findings: SemanticDependencySourceIssue[] = [];

  if (content.includes('../../primitives/colors.js')) {
    findings.push(
      issue(
        'generated-token-primitive-bypass',
        'Generated theme token construction imports primitive colors directly.',
        componentTokenDependencyPolicyV1.generatorRule
      )
    );
  }

  if (content.includes('../semantic/action.js')) {
    findings.push(
      issue(
        'generated-token-deprecated-action-dependency',
        'Generated theme token construction imports deprecated semantic/action.',
        componentTokenDependencyPolicyV1.generatorRule
      )
    );
  }

  return findings;
}
