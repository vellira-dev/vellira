import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { componentExpansionCatalog } from '@vellira-ui/metadata';

import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';
import { productionSeedForTarget } from '../component-production/production-seed';

export function genericReservationRequest() {
  const target = componentExpansionCatalog.find(({ name }) => name === 'Badge');
  if (!target) throw new Error('Missing generic tokenized expansion fixture.');
  return componentTokenReservationRequest(
    productionSeedForTarget(target),
    'components.Badge',
    true
  );
}

export function temporaryRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-reservation-'));
  const registry = path.join(root, 'packages/metadata/src/tokenLifecycle.ts');
  fs.mkdirSync(path.dirname(registry), { recursive: true });
  fs.copyFileSync(
    path.resolve('packages/metadata/src/tokenLifecycle.ts'),
    registry
  );
  git(root, ['init', '--initial-branch=reservation-test']);
  git(root, ['config', 'user.email', 'reservation-test@vellira.dev']);
  git(root, ['config', 'user.name', 'Vellira Test']);
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'test fixture']);
  return {
    root,
    registry,
    sourceRevision: git(root, ['rev-parse', 'HEAD']).trim(),
    restore() {
      fs.copyFileSync(
        path.resolve('packages/metadata/src/tokenLifecycle.ts'),
        registry
      );
    },
    dispose() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}

export function git(root: string, args: readonly string[]) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
}
