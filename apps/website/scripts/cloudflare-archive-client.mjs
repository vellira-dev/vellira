import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unstable_getMiniflareWorkerOptions } from 'wrangler';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { startArchiveSession } from './cloudflare-archive-session.mjs';

export async function withRemoteArchive(config, operation) {
  const binding = config.r2_buckets?.find(
    (entry) => entry.binding === 'STATIC_ASSET_ARCHIVE'
  );
  assert.ok(binding?.bucket_name, 'Missing immutable archive configuration');
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-archive-proxy-')
  );
  try {
    const configPath = path.join(temporary, 'wrangler.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        name: `${config.name}-archive-upload`,
        account_id: config.account_id ?? process.env.CLOUDFLARE_ACCOUNT_ID,
        compatibility_date: config.compatibility_date,
        r2_buckets: [{ ...binding, remote: true }],
      })
    );
    const session = await startArchiveSession(configPath);
    try {
      const { workerOptions, externalWorkers } =
        unstable_getMiniflareWorkerOptions(configPath, undefined, {
          remoteProxyConnectionString: session.connection,
        });
      // This inline, sourceless probe has no imports. Miniflare v5 rejects v4
      // modulesRules for inline scripts; no application module rules are needed.
      delete workerOptions.modulesRules;
      const proxy = new Miniflare(
        convertV4MiniflareOptions({
          workers: [
            {
              ...workerOptions,
              modules: true,
              script:
                'export default {fetch(){return new Response(null,{status:404})}}',
            },
            ...externalWorkers,
          ],
        })
      );
      try {
        return await operation(
          await proxy.getR2Bucket('STATIC_ASSET_ARCHIVE'),
          binding.bucket_name
        );
      } finally {
        await proxy.dispose();
      }
    } finally {
      await session.dispose();
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
