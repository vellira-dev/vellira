import { describe, expect, it } from 'vitest';

import {
  createComponentNoShadowIntent,
  createComponentShadowIntent,
} from '../../../packages/tokens/src/platform-output/component-token-intents';
import {
  auditComponentShadowConsumers,
  checkComponentShadowConsumers,
} from './shadow-component-consumption';

function createRequiredConsumerFixture() {
  return {
    tooltip: { content: { shadow: createComponentShadowIntent('md') } },
    popover: { content: { shadow: createComponentShadowIntent('lg') } },
    modal: { content: { shadow: createComponentShadowIntent('xl') } },
    dropdown: { content: { shadow: createComponentShadowIntent('lg') } },
    select: {
      dropdown: { shadow: createComponentShadowIntent('lg') },
      option: { selected: { shadow: createComponentNoShadowIntent() } },
    },
  };
}

describe('component shadow consumption audit', () => {
  it('proves all maintained #885 component consumers use canonical shadow intents', () => {
    const result = checkComponentShadowConsumers();
    expect(result.checked).toBeGreaterThan(15);
    expect(result.findings).toEqual([]);
  });

  it('rejects an authored component shadow value', () => {
    const components = createRequiredConsumerFixture();
    components.tooltip.content.shadow =
      '0 1px 2px rgba(0, 0, 0, 0.2)' as never;

    const result = auditComponentShadowConsumers(
      components,
      'fixture',
      'fixture/components.ts'
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'required-component-shadow-not-intent',
          tokenPath: 'components.tooltip.content.shadow',
        }),
        expect.objectContaining({
          code: 'authored-component-shadow-value',
          tokenPath: 'components.tooltip.content.shadow',
        }),
      ])
    );
  });

  it('rejects renderer-native shadow fields in canonical component tokens', () => {
    const components = {
      ...createRequiredConsumerFixture(),
      probe: { shadowOpacity: 0.2 },
    };

    const result = auditComponentShadowConsumers(
      components,
      'fixture',
      'fixture/components.ts'
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'renderer-shadow-field-in-component-token',
          tokenPath: 'components.probe.shadowOpacity',
        }),
      ])
    );
  });
});
