import fs from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';
import {
  reserveComponentTokenFamily,
  validateReservationRequest,
} from './resolver';
import {
  genericReservationRequest,
  git,
  temporaryRepository,
} from './test-helpers';

const dispose: Array<() => void> = [];
afterEach(() => dispose.splice(0).forEach((callback) => callback()));

describe('component-token reservation resolver', () => {
  it('performs only the deterministic unregistered -> reserved mutation', () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const request = genericReservationRequest();
    const result = reserveComponentTokenFamily({
      root: fixture.root,
      sourceRevision: fixture.sourceRevision,
      request,
    });

    expect(result.action).toBe('reserved');
    expect(result.entry).toEqual({
      status: 'reserved',
      public: true,
      owner: 'Badge',
      purpose: 'Reserved for the canonical Badge component token contract.',
    });
    expect(fs.readFileSync(fixture.registry, 'utf8')).toBe(result.nextSource);
    expect(git(fixture.root, ['diff', '--name-only']).trim()).toBe(
      'packages/metadata/src/tokenLifecycle.ts'
    );
    expect(result.nextSource).not.toContain(
      "status: 'current',\n    public: true,\n    owner: 'Badge'"
    );
  });

  it('accepts an exact existing reservation as an idempotent no-op', () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const request = genericReservationRequest();
    reserveComponentTokenFamily({
      root: fixture.root,
      sourceRevision: fixture.sourceRevision,
      request,
    });
    git(fixture.root, ['add', '.']);
    git(fixture.root, ['commit', '-m', 'reserve fixture']);
    const revision = git(fixture.root, ['rev-parse', 'HEAD']).trim();
    const result = reserveComponentTokenFamily({
      root: fixture.root,
      sourceRevision: revision,
      request,
    });
    expect(result.action).toBe('no-op');
    expect(result.mutationOccurred).toBe(false);
  });

  it.each(['current', 'deprecated', 'reserved'])(
    'rejects an incompatible existing %s entry',
    (status) => {
      const fixture = temporaryRepository();
      dispose.push(fixture.dispose);
      const request = genericReservationRequest();
      const source = fs.readFileSync(fixture.registry, 'utf8');
      fs.writeFileSync(
        fixture.registry,
        source.replace(
          'export const componentTokenLifecycle = {',
          `export const componentTokenLifecycle = {\n  Badge: {\n    status: '${status}',\n    public: ${status === 'reserved' ? 'false' : 'true'},\n    owner: 'not-Badge',\n    purpose: 'Incompatible authority.',\n  },`
        )
      );
      git(fixture.root, ['add', '.']);
      git(fixture.root, ['commit', '-m', 'existing fixture']);
      const revision = git(fixture.root, ['rev-parse', 'HEAD']).trim();
      expect(() =>
        reserveComponentTokenFamily({
          root: fixture.root,
          sourceRevision: revision,
          request,
        })
      ).toThrow(/already exists/);
    }
  );

  it('rejects stale revisions and request identity, token intent, registry, and catalog drift', () => {
    const fixture = temporaryRepository();
    dispose.push(fixture.dispose);
    const request = genericReservationRequest();
    expect(() =>
      reserveComponentTokenFamily({
        root: fixture.root,
        sourceRevision: '0'.repeat(40),
        request,
      })
    ).toThrow(/Stale/);
    for (const invalid of [
      { ...request, requestId: `${request.requestId}-wrong` },
      {
        ...request,
        reservation: { ...request.reservation!, registryPath: 'other.ts' },
      },
      {
        ...request,
        productionSeed: { ...request.productionSeed!, componentTokens: false },
      },
      {
        ...request,
        productionSeed: { ...request.productionSeed!, category: 'feedback' },
      },
    ]) {
      expect(() => validateReservationRequest(invalid)).toThrow();
    }
    expect(() =>
      componentTokenReservationRequest(
        { ...request.productionSeed!, componentTokens: false },
        request.consumer
      )
    ).toThrow(/Tokenless/);
  });
});

it('keeps Generator V2 as the sole reserved -> current owner', () => {
  const productionFiles = fs
    .readdirSync('scripts', { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => `scripts/${file}`);
  const owners = productionFiles.filter((file) =>
    fs.readFileSync(file, 'utf8').includes('promoteReservedTokenFamily(')
  );
  expect(owners.sort()).toEqual([
    'scripts/generators/component/token-lifecycle-contract.ts',
    'scripts/token-lifecycle/authority.ts',
  ]);
});
