import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { darkTheme } from './dark/theme.js';
import { highContrastTheme } from './highContrast/theme.js';
import { lightTheme } from './light/theme.js';
import {
  canonicalInteractionStates,
  canonicalTokenVocabulary,
  interactionStateVocabularyV1,
  legitimatePersistentActiveStateDomainsV1,
} from './token-architecture.js';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const repositoryRoot = path.resolve(packageRoot, '..', '..');

const themes = [
  ['light', lightTheme],
  ['dark', darkTheme],
  ['high-contrast', highContrastTheme],
] as const;

describe('interaction state vocabulary V1', () => {
  it('defines one canonical meaning for every interaction state', () => {
    expect(canonicalInteractionStates).toEqual([
      'default',
      'hover',
      'pressed',
      'active',
      'selected',
      'disabled',
      'focus',
    ]);
    // Keep both machine-readable state authorities in exact lockstep.
    expect(canonicalTokenVocabulary.state).toEqual(canonicalInteractionStates);

    expect(interactionStateVocabularyV1.pressed.temporality).toBe('transient');
    expect(interactionStateVocabularyV1.pressed.meaning).toMatch(
      /physical pointer or key activation/i
    );
    expect(interactionStateVocabularyV1.active.temporality).toBe(
      'persistent-or-current'
    );
    expect(interactionStateVocabularyV1.active.meaning).toMatch(
      /never.*physical press/i
    );
    expect(interactionStateVocabularyV1.selected.temporality).toBe(
      'persistent'
    );
  });

  it.each(themes)(
    '%s uses pressed semantics for generic controls',
    (_name, theme) => {
      expect(theme.semantic.control).toHaveProperty('pressed');
      expect(theme.semantic.control).not.toHaveProperty('active');
      expect(theme.semantic.control.selected).toHaveProperty('pressed');
      expect(theme.semantic.control.selected).not.toHaveProperty('active');

      expect(theme.components.radio.pressed).toEqual(
        theme.semantic.control.pressed
      );
      expect(theme.components.switch.on.pressed).toEqual({
        trackBg: theme.semantic.control.selected.pressed.bg,
        trackBorder: theme.semantic.control.selected.pressed.border,
        thumbBg: theme.semantic.control.selected.pressed.fg,
      });
    }
  );

  it.each(themes)(
    '%s names transient action states pressed',
    (_name, theme) => {
      for (const action of Object.values(theme.semantic.action)) {
        expect(action).toHaveProperty('pressed');
        expect(action).not.toHaveProperty('active');
      }

      expect(theme.semantic.text).toHaveProperty('interactivePressed');
      expect(theme.semantic.text).not.toHaveProperty('interactiveActive');
    }
  );

  it.each(themes)(
    '%s maps clear-button press to pressed surface semantics',
    (_name, theme) => {
      expect(theme.components.input.clearButton.pressedBg).toBe(
        theme.semantic.surface.pressed
      );
      expect(theme.components.select.clearButton.pressedBg).toBe(
        theme.semantic.surface.pressed
      );
    }
  );

  it.each(themes)(
    '%s keeps active where current/highlighted is a real domain state',
    (_name, theme) => {
      expect(theme.semantic.menu.item).toHaveProperty('active');
      expect(theme.semantic.menu.item).toHaveProperty('pressed');
      expect(theme.components.select.option).toHaveProperty('active');
      expect(theme.components.select.option).toHaveProperty('pressed');
      expect(theme.components.dropdown.item).toHaveProperty('active');
      expect(theme.components.dropdown.item).toHaveProperty('pressed');
      expect(theme.components.tabs.primary.trigger).toHaveProperty('active');
    }
  );

  it('documents every intentional persistent/current active domain', () => {
    expect(legitimatePersistentActiveStateDomainsV1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: 'semantic.surface.active' }),
        expect.objectContaining({ pattern: 'semantic.menu.item.active' }),
        expect.objectContaining({
          pattern: 'components.select.*.option.active',
        }),
        expect.objectContaining({
          pattern: 'components.dropdown.*.item.active',
        }),
        expect.objectContaining({ pattern: 'components.tabs.*.*.active' }),
      ])
    );
  });

  it('keeps Radio physical press motion under the pressed name only', () => {
    for (const [, theme] of themes) {
      expect(theme.components.radio.motion.pressedScale).toBe(0.92);
      expect(theme.components.radio.motion).not.toHaveProperty('activeScale');
    }

    const radioStyles = fs.readFileSync(
      path.join(
        repositoryRoot,
        'packages/react/src/primitives/Radio/Radio.module.scss'
      ),
      'utf8'
    );

    expect(radioStyles).toContain('var(--radio-motion-pressed-scale)');
    expect(radioStyles).not.toContain('radio-motion-active-scale');
  });

  it('does not map pressed component contracts back to active semantics', () => {
    const sourceFiles = [
      'packages/tokens/src/factories/components/createSwitchTokens.ts',
      'packages/tokens/src/light/components/input.ts',
      'packages/tokens/src/dark/components/input.ts',
      'packages/tokens/src/highContrast/components/input.ts',
      'packages/tokens/src/light/components/select.ts',
      'packages/tokens/src/dark/components/select.ts',
      'packages/tokens/src/highContrast/components/select.ts',
      'scripts/generators/component/templates/component-tokens.ts',
    ];

    for (const relativePath of sourceFiles) {
      const source = fs.readFileSync(
        path.join(repositoryRoot, relativePath),
        'utf8'
      );

      expect(source, relativePath).not.toContain('control.selected.active');
      expect(source, relativePath).not.toMatch(
        /pressed\s*:\s*control\.active\b/
      );
      expect(source, relativePath).not.toMatch(
        /pressedBg\s*:\s*surface\.active\b/
      );
    }
  });
});
