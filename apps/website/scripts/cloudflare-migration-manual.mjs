import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildGenerations,
  startMigrationOrigin,
} from './cloudflare-migration-origin.mjs';
import { assertRuntimeAsset } from './cloudflare-runtime-asset-contract.mjs';

const help =
  'Commands: A | B | C | poison on | poison off | status | check | save | quit';

// Terminal-only controls; no remotely reachable activation/poison endpoint.
export async function manualCommand(origin, command) {
  if (['A', 'B', 'C'].includes(command)) await origin.activate(command);
  else if (command === 'poison on') origin.state.poison = true;
  else if (command === 'poison off') origin.state.poison = false;
  else assert.ok(['status', 'check', 'save', 'quit'].includes(command), help);
  return command === 'quit';
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(`Local real-Safari fixture (never deploys a Worker).\n${help}`);
    return;
  }
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-safari-evidence-')
  );
  const git = (...args) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const provenance = {
    head: git('rev-parse', 'HEAD'),
    worktreeClean: git('status', '--porcelain') === '',
  };
  console.log(`Evidence: ${directory}; building fresh A/B/C fixtures…`);
  const generations = await buildGenerations(directory);
  const origin = await startMigrationOrigin(generations, directory);
  const activated = new Set(['A']);
  const events = [];
  const inventory = Object.fromEntries(
    Object.entries(generations).map(([key, build]) => [
      key,
      {
        buildId: build.buildId,
        assets: build.assets,
      },
    ])
  );
  const save = () =>
    fs.writeFile(
      path.join(directory, 'manual-evidence.json'),
      JSON.stringify(
        {
          provenance,
          origin: origin.url,
          generations: inventory,
          state: origin.state,
          activated: [...activated],
          events,
          // Infrastructure success is never a fabricated manual Safari pass.
          safariVerdict:
            'unassessed: attach manual checklist, browser evidence and versions',
          originRequests: origin.requests,
        },
        null,
        2
      )
    );
  const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const interrupt = () => input.close();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    await save();
    console.log(`Open in real Safari: ${origin.url}\n${help}`);
    for await (const line of input) {
      const command = line.trim();
      if (!command) continue;
      const quit = await manualCommand(origin, command);
      if (['A', 'B', 'C'].includes(command)) activated.add(command);
      if (command === 'check') {
        let checked = 0;
        for (const key of activated)
          for (const asset of generations[key].assets) {
            const response = await fetch(
              new URL(
                asset.pathname.split('/').map(encodeURIComponent).join('/'),
                origin.url
              ),
              { cache: 'no-store' }
            );
            const bytes = Buffer.from(await response.arrayBuffer());
            assertRuntimeAsset(asset, { response, bytes });
            checked++;
          }
        events.push({ at: Date.now(), kind: 'asset-closure', checked });
      }
      events.push({
        at: Date.now(),
        command,
        state: { ...origin.state },
        requests: origin.requests.length,
      });
      await save();
      console.log(
        JSON.stringify({
          command,
          state: origin.state,
          requests: origin.requests.length,
        })
      );
      if (quit) break;
    }
  } finally {
    input.close();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    try {
      await save();
    } finally {
      await origin.close();
    }
    console.log(`Saved ${path.join(directory, 'manual-evidence.json')}`);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
