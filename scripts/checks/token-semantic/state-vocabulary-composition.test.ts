import { describe, expect, it } from 'vitest';

import {
  interactionStatePlatformContractV1,
  selectedCompoundStateGrammarV1,
} from '../../../packages/tokens/src/interaction-state-contract';
import { canonicalInteractionStates } from '../../../packages/tokens/src/token-architecture';
import {
  auditRendererStateWitness,
  checkTokenStateVocabularyCompletion,
} from './state-vocabulary-composition';

const root = process.cwd();

describe('state vocabulary completion', () => {
  it('proves compound-state and platform renderer contracts without findings', () => {
    const result = checkTokenStateVocabularyCompletion(root);
    expect(result.checked).toBeGreaterThan(20);
    expect(result.findings).toEqual([]);
  });

  it('covers every canonical state in selected composition and both platform mappings', () => {
    const expected = [...canonicalInteractionStates].sort();
    expect(Object.keys(selectedCompoundStateGrammarV1).sort()).toEqual(
      expected
    );
    expect(Object.keys(interactionStatePlatformContractV1.web).sort()).toEqual(
      expected
    );
    expect(
      Object.keys(interactionStatePlatformContractV1['react-native']).sort()
    ).toEqual(expected);

    expect(selectedCompoundStateGrammarV1.pressed).toMatchObject({
      strategy: 'selected-variant',
      semanticPath: 'semantic.control.selected.pressed',
    });
    expect(selectedCompoundStateGrammarV1.disabled).toMatchObject({
      strategy: 'disabled-wins',
      semanticPath: 'semantic.control.disabled',
    });
    expect(selectedCompoundStateGrammarV1.focus.strategy).toBe(
      'orthogonal-focus'
    );
    expect(selectedCompoundStateGrammarV1.active.strategy).toBe(
      'domain-specific-active'
    );
  });

  it('does not require native hover and keeps physical press distinct from active', () => {
    const web = interactionStatePlatformContractV1.web;
    const native = interactionStatePlatformContractV1['react-native'];

    expect(web.hover).toMatchObject({ support: 'required', signal: ':hover' });
    expect(web.pressed).toMatchObject({
      support: 'required',
      signal: ':active',
    });
    expect(native.hover).toMatchObject({
      support: 'optional',
      signal: 'pointer-hover-when-capable',
    });
    expect(native.pressed).toMatchObject({
      support: 'required',
      signal: 'PressableStateCallbackType.pressed',
    });
    expect(web.active.signal).toBe('domain-current');
    expect(native.active.signal).toBe('domain-current');
  });

  it('fails closed when required renderer evidence disappears', () => {
    const findings = auditRendererStateWitness(
      {
        platform: 'web',
        sourcePath: 'fixture.scss',
        patterns: [
          {
            code: 'fixture-pressed-missing',
            pattern: /--pressed/,
            expected: 'Fixture must expose pressed evidence.',
          },
        ],
      },
      '.control { color: red; }'
    );

    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'tokens.state-vocabulary',
        code: 'fixture-pressed-missing',
        severity: 'error',
        platform: 'web',
      }),
    ]);
  });
});
