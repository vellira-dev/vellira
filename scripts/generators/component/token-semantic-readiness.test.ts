import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { TokenSemanticReport } from '../../checks/token-semantic/contract';
import {
  assertComponentGeneratorTokenSemanticReadiness,
  componentGeneratorCheckRequiresTokenSemanticGate,
} from './token-semantic-readiness';

function report(status: TokenSemanticReport['status']): TokenSemanticReport {
  return {
    schemaVersion: 1,
    status,
    coverage: [],
    findings: [],
    summary: {
      requiredRules: 12,
      completeRules: status === 'pass' ? 12 : 11,
      incompleteRules: status === 'pass' ? 0 : 1,
      runtimeErrors: status === 'error' ? 1 : 0,
      errors: status === 'fail' ? 1 : 0,
      warnings: 0,
    },
  };
}

describe('component generator token semantic readiness', () => {
  it('requires the shared semantic gate for component tokens or explicit token resources', () => {
    expect(
      componentGeneratorCheckRequiresTokenSemanticGate({
        componentTokens: 'standard',
      })
    ).toBe(true);
    expect(
      componentGeneratorCheckRequiresTokenSemanticGate({
        componentTokens: false,
        requestedTokens: ['semantic.surface.canvas'],
      })
    ).toBe(true);
    expect(
      componentGeneratorCheckRequiresTokenSemanticGate({
        componentTokens: false,
      })
    ).toBe(false);
  });

  it('accepts only a shared token semantic pass', async () => {
    await expect(
      assertComponentGeneratorTokenSemanticReadiness('/repo', () =>
        report('pass')
      )
    ).resolves.toBeUndefined();
  });

  it.each(['incomplete', 'fail', 'error'] as const)(
    'rejects %s semantic architecture before generator check may pass',
    async (status) => {
      await expect(
        assertComponentGeneratorTokenSemanticReadiness('/repo', () =>
          report(status)
        )
      ).rejects.toThrow('Component generator token semantic validation failed');
    }
  );

  it('keeps the real Generator V2 --check CLI wired to the shared authority', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'scripts/generators/component/create-component.ts'
      ),
      'utf8'
    );

    expect(source).toContain(
      'componentGeneratorCheckRequiresTokenSemanticGate({'
    );
    expect(source).toContain(
      'await assertComponentGeneratorTokenSemanticReadiness(process.cwd());'
    );
  });
});
