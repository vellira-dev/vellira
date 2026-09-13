import { describe, expect, it } from 'vitest';

import { auditGeneratedThemeTokenDependencySource } from '../../../packages/tokens/src/component-token-dependency-audit';
import { componentTokenDependencyPolicyV1 } from '../../../packages/tokens/src/component-token-dependencies';
import {
  assertGeneratedThemeTokenDependencyPolicy,
  componentTokenDependencyGeneratorRule,
  generatedThemeTokenDependencyAudit,
} from './token-dependency-contract';

describe('Generator V2 token dependency contract', () => {
  it('consumes the canonical component token dependency rule and shared audit', () => {
    expect(componentTokenDependencyGeneratorRule).toBe(
      componentTokenDependencyPolicyV1.generatorRule
    );
    expect(generatedThemeTokenDependencyAudit).toBe(
      auditGeneratedThemeTokenDependencySource
    );
  });

  it('fails closed when generated theme tokens bypass semantics with primitive colors', () => {
    expect(() =>
      assertGeneratedThemeTokenDependencyPolicy(
        "import { colors } from '../../primitives/colors.js';"
      )
    ).toThrow('generated-token-primitive-bypass');
  });

  it('fails closed on deprecated generated action semantics', () => {
    expect(() =>
      assertGeneratedThemeTokenDependencyPolicy(
        "import { action } from '../semantic/action.js';"
      )
    ).toThrow('generated-token-deprecated-action-dependency');
  });

  it('accepts semantic-first generated theme construction', () => {
    expect(() =>
      assertGeneratedThemeTokenDependencyPolicy(
        "import { control } from '../semantic/control.js';"
      )
    ).not.toThrow();
  });
});
