import { execFileSync } from 'node:child_process';
import { componentExpansionCatalog } from '@vellira-ui/metadata';
import { createHash } from 'node:crypto';
import { readTokenLifecycleAuthority } from '../token-lifecycle/authority';
import { parseComponentProductionSeed } from './production-seed';

export const COMPONENT_TOKEN_REGISTRY =
  'packages/metadata/src/tokenLifecycle.ts';

/** No mutation, generation or implicit reservation. Reads canonical source, not dist. */
export function resolveComponentProductionEligibility(
  value: unknown,
  root = process.cwd()
) {
  const seed = parseComponentProductionSeed(value);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error('Eligibility requires an exact Git revision.');
  const authority = readTokenLifecycleAuthority(root);
  const observed = authority.components[seed.componentName];
  const entry = observed
    ? {
        status: observed.status,
        public: observed.public,
        owner: observed.owner,
        purpose: observed.purpose,
      }
    : null;
  const tokenless = seed.componentTokens === false;
  const target = componentExpansionCatalog.find(
    ({ name }) => name === seed.componentName
  );
  const intentMismatch =
    target !== undefined && target.componentTokens !== seed.componentTokens;
  const hardInvalid =
    intentMismatch ||
    (!tokenless &&
      entry !== null &&
      (entry.status === 'deprecated' ||
        entry.owner !== seed.componentName ||
        !entry.public));
  const eligible = !hardInvalid && (tokenless || entry !== null);
  const evidence = {
    schemaVersion: '1' as const,
    revision,
    seed,
    registry: {
      path: COMPONENT_TOKEN_REGISTRY,
      sha256: createHash('sha256')
        .update(authority.source, 'utf8')
        .digest('hex'),
      entry,
    },
    eligible,
    hardInvalid,
    lifecycleMutationRequired:
      !tokenless && eligible && entry?.status === 'reserved',
    reason: hardInvalid
      ? 'invalid-component-token-lifecycle'
      : tokenless
        ? 'tokenless'
        : !entry
          ? 'component-token-reservation-required'
          : entry.status,
  };
  return {
    ...evidence,
    fingerprint: createHash('sha256')
      .update(JSON.stringify(evidence))
      .digest('hex'),
  };
}

export type ComponentProductionEligibilityV1 = ReturnType<
  typeof resolveComponentProductionEligibility
>;
