import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getPlatformProxy } from 'wrangler';

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
    const proxy = await getPlatformProxy({
      configPath,
      remoteBindings: true,
      persist: false,
    });
    try {
      return await operation(
        proxy.env.STATIC_ASSET_ARCHIVE,
        binding.bucket_name
      );
    } finally {
      await proxy.dispose();
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
