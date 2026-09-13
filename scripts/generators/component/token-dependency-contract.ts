import { auditGeneratedThemeTokenDependencySource } from '../../../packages/tokens/src/component-token-dependency-audit';
import { componentTokenDependencyPolicyV1 } from '../../../packages/tokens/src/component-token-dependencies';

export const componentTokenDependencyGeneratorRule =
  componentTokenDependencyPolicyV1.generatorRule;

export const generatedThemeTokenDependencyAudit =
  auditGeneratedThemeTokenDependencySource;

export function assertGeneratedThemeTokenDependencyPolicy(content: string) {
  const issues = generatedThemeTokenDependencyAudit(content);
  if (issues.length === 0) return;

  const first = issues[0]!;
  throw new Error(`${first.code}: ${componentTokenDependencyGeneratorRule}`);
}
