import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';
import { verifyNextPatch } from './next-rsc-patch-check.mjs';

process.env.VELLIRA_DEPLOYABLE = '1';
deploymentIdentity();
verifyNextPatch();
// OpenNext sets NODE_ENV=production. Running pnpm exec here can trigger pnpm
// 11's automatic production-only reinstall; use the verified installed CLI.
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [require.resolve('next/dist/bin/next'), 'build', '--webpack'],
  {
    stdio: 'inherit',
    env: process.env,
  }
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
