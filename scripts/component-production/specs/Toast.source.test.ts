import { describe, expect, it } from 'vitest';

import { compileProductionProgram } from '../../component-program/cli';
import specification from './Toast.json';
import planning from './Toast.planning.json';

describe('transient feedback source decisions', () => {
  for (const componentName of ['Toast', 'NotificationPanel', 'StatusMessage']) {
    it(`compiles explicit state and platform decisions for ${componentName}`, () => {
      const result = compileProductionProgram({
        ...specification,
        componentName,
      });
      expect(result.disposition).toBe('compiled');
      if (result.disposition !== 'compiled' || !result.program)
        throw new Error('Unresolved source');
      expect(result.program.obligations).toHaveLength(35);
      const state = specification.componentProgram.states[0];
      expect(state.ownership).toBe('controlled-uncontrolled');
      expect(state.change?.emitTransitions).toEqual(['to-false']);
      expect(
        state.change?.reasonDomain.values.map((value) => value.value)
      ).toEqual(['action', 'dismiss', 'timeout']);
      expect(planning.contractIr.states[0].changeCallbackTransitions).toEqual([
        'to-false',
      ]);
    });
  }

  it('contains reviewable API data without embedded approval or execution claims', () => {
    expect(Object.keys(planning).sort()).toEqual([
      'apiMembers',
      'contractIr',
      'evidenceId',
      'obligations',
      'platformScope',
      'risk',
      'schemaVersion',
      'supportedCapabilities',
    ]);
    expect(planning.apiMembers).toEqual([]);
    expect(
      planning.contractIr.objects[0].fields.map((field) => field.name)
    ).toEqual(['accessibilityLabel', 'label', 'onAction']);
    expect(
      planning.contractIr.members.some(
        (member) => member.owner === 'Viewport' && member.name === 'maxVisible'
      )
    ).toBe(true);
    expect(
      planning.obligations.find((row) => row.id === 'duration-policy')
        ?.consequence
    ).toContain(
      'An action with explicitly positive duration is invalid: reject deterministically'
    );
  });
});
