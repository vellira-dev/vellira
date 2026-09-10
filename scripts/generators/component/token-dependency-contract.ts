import { componentTokenDependencyPolicyV1 } from '../../../packages/tokens/src/component-token-dependencies';

export const componentTokenDependencyGeneratorRule =
  componentTokenDependencyPolicyV1.generatorRule;

export function assertGeneratedThemeTokenDependencyPolicy(content: string) {
  if (content.includes('../../primitives/colors.js')) {
    throw new Error(
      `generated-token-primitive-bypass: ${componentTokenDependencyGeneratorRule}`
    );
  }
}
