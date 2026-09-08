import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  canonicalShadowEffects,
  type ElevationShadowLevel,
  elevationShadowLevels,
} from './shadow-system.js';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
);

function expectedNativeApproximationLevel(
  level: ElevationShadowLevel
): ElevationShadowLevel {
  const approximation =
    canonicalShadowEffects.elevation[level].reactNativeApproximation;

  return approximation.kind === 'direct' ? level : approximation.level;
}

describe('shadow platform boundary', () => {
  it('keeps RN selector aligned with canonical metadata', () => {
    const source = fs.readFileSync(
      path.join(
        repositoryRoot,
        'packages/react-native/src/theme/componentTokenOutput.ts'
      ),
      'utf8'
    );
    const block = source.match(
      /const reactNativeShadowApproximationLevel = \{([\s\S]*?)\} as const/
    );

    expect(block).not.toBeNull();

    const actual = Object.fromEntries(
      [...block![1]!.matchAll(/\b(sm|md|lg|xl): '(sm|md|lg|xl)'/g)].map(
        ([, level, nativeLevel]) => [level, nativeLevel]
      )
    );
    const expected = Object.fromEntries(
      elevationShadowLevels.map((level) => [
        level,
        expectedNativeApproximationLevel(level),
      ])
    );

    expect(actual).toEqual(expected);
    expect(source).not.toMatch(/\b(?:blur|opacity|elevation):\s*(?:\d|['"]#)/);
  });
});
