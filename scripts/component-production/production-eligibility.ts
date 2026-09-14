import { execFileSync } from 'node:child_process';
import { componentExpansionCatalog } from '@vellira-ui/metadata';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readTokenLifecycleAuthority } from '../token-lifecycle/authority';
import { parseComponentProductionSeed } from './production-seed';

export const COMPONENT_TOKEN_REGISTRY =
  'packages/metadata/src/tokenLifecycle.ts';

type ReadOnlyGitRunner = (
  file: string,
  args: readonly string[],
  options: { cwd: string; encoding: 'utf8'; shell: false }
) => string;

export function readComponentProductionGit(
  root: string,
  args: readonly ['rev-parse', 'HEAD'],
  runner: ReadOnlyGitRunner = (file, commandArgs, options) =>
    execFileSync(file, commandArgs, options)
) {
  const resolvedRoot = path.resolve(root);
  return runner('git', ['-c', `safe.directory=${resolvedRoot}`, ...args], {
    cwd: resolvedRoot,
    encoding: 'utf8',
    shell: false,
  }).trim();
}

/** No mutation, generation or implicit reservation. Reads canonical source, not dist. */
export function resolveComponentProductionEligibility(
  value: unknown,
  root = process.cwd()
) {
  const resolvedRoot = path.resolve(root);
  const seed = parseComponentProductionSeed(value);
  const revision = readComponentProductionGit(resolvedRoot, [
    'rev-parse',
    'HEAD',
  ]);
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error('Eligibility requires an exact Git revision.');
  const authority = readTokenLifecycleAuthority(resolvedRoot);
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
