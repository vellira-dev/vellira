import { describe, expect, it } from 'vitest';

import { componentTokenDependencyPolicyV1 } from '../../../packages/tokens/src/component-token-dependencies';
import {
  assertGeneratedThemeTokenDependencyPolicy,
  componentTokenDependencyGeneratorRule,
} from './token-dependency-contract';

describe('Generator V2 token dependency contract', () => {
  it('consumes the canonical component token dependency rule', () => {
    expect(componentTokenDependencyGeneratorRule).toBe(
      componentTokenDependencyPolicyV1.generatorRule
    );
  });

  it('fails closed when generated theme tokens bypass semantics with primitive colors', () => {
    expect(() =>
      assertGeneratedThemeTokenDependencyPolicy(
        "import { colors } from '../../primitives/colors.js';"
      )
    ).toThrow('generated-token-primitive-bypass');
  });

  it('accepts semantic-first generated theme construction', () => {
    expect(() =>
      assertGeneratedThemeTokenDependencyPolicy(
        "import { control } from '../semantic/control.js';"
      )
    ).not.toThrow();
  });
});
