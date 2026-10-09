import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import {
  createLocalCacheConfig,
  populateLocalCache,
  withLocalCacheConfig,
} from './cloudflare-populate-local-cache.mjs';
import { drainSiteNavigationNetwork } from './cloudflare-site-navigation-browser.mjs';

const root = path.resolve(import.meta.dirname, '..');
const repo = path.resolve(root, '../..');
const configs = ['wrangler.jsonc', 'wrangler.production.jsonc'];
const requiredSecrets = ['BUTTONDOWN_API_KEY'];

function sampleConfig() {
  return {
    name: 'vellira-website',
    account_id: 'local-test-account',
    main: './cloudflare-worker.mjs',
    compatibility_date: '2026-09-06',
    compatibility_flags: ['nodejs_compat'],
    secrets: { required: requiredSecrets },
    routes: [{ pattern: 'vellira.dev', custom_domain: true }],
    workers_dev: true,
    assets: { directory: '.open-next/assets', binding: 'ASSETS' },
    vars: { CACHE_PREFIX: 'fixture-prefix' },
    r2_buckets: [{ binding: 'STATIC_ASSET_ARCHIVE', bucket_name: 'fixture' }],
  };
}

test('projection: omits runtime secret requirements without altering the source', () => {
  const source = sampleConfig();
  const before = structuredClone(source);
  const local = createLocalCacheConfig(source);
  assert.deepEqual(local.secrets, { required: [] });
  assert.deepEqual(source, before);
  assert.notEqual(local, source);
  assert.notEqual(local.secrets, source.secrets);
});

test('projection: preserves cache bindings, compatibility and relative paths', () => {
  const source = sampleConfig();
  const local = createLocalCacheConfig(source);
  for (const key of [
    'main',
    'compatibility_date',
    'compatibility_flags',
    'assets',
    'vars',
    'r2_buckets',
  ]) {
    assert.deepEqual(local[key], source[key], key);
  }
});

test('projection: cannot masquerade as a public deployment target', () => {
  const source = sampleConfig();
  source.route = 'legacy.example/*';
  const local = createLocalCacheConfig(source);
  assert.equal(local.name, 'vellira-local-cache');
  assert.equal(local.workers_dev, false);
  assert.equal(local.preview_urls, false);
  assert.deepEqual(local.routes, []);
  assert.equal(local.route, undefined);
  assert.equal(local.account_id, undefined);
});

test('projection: environment overlays are rejected rather than silently weakened', () => {
  const source = sampleConfig();
  source.env = { production: { secrets: { required: requiredSecrets } } };
  assert.throws(() => createLocalCacheConfig(source), /environment overlays/);
});

test('projection: explicitly remote bindings cannot enter local preparation', () => {
  const source = sampleConfig();
  source.r2_buckets[0].remote = true;
  assert.throws(() => createLocalCacheConfig(source), /remote bindings/);
});

test('projection: invalid input is rejected', () => {
  for (const input of [null, undefined, 1, 'config', []]) {
    assert.throws(() => createLocalCacheConfig(input));
  }
});

test('CLI rejects remote operations, alternate commands and flag passthrough', () => {
  for (const args of [
    ['remote'],
    ['deploy'],
    ['--env=production'],
    ['wrangler.jsonc', '--remote'],
  ]) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, 'scripts/cloudflare-populate-local-cache.mjs'), ...args],
      {
        encoding: 'utf8',
        timeout: 5_000,
      }
    );
    assert.equal(result.status, 1, JSON.stringify(args));
    assert.match(result.stderr, /remote commands and flags are forbidden/);
  }
});

async function loadNextConfig(initialize) {
  const ts = await import('typescript');
  const source = await fs.readFile(path.join(root, 'next.config.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  const imports = {
    '@next/mdx': () => (config) => config,
    '@opennextjs/cloudflare': { initOpenNextCloudflareForDev: initialize },
    'next/constants': { PHASE_DEVELOPMENT_SERVER: 'phase-development-server' },
    './cloudflare/build-identity.mjs': {
      deploymentIdentity: () => 'fixture-build-id',
    },
  };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(
        Object.hasOwn(imports, name),
        `Unexpected config import: ${name}`
      );
      return imports[name];
    },
  });
  return module.exports.default;
}

test('Next build/start do not initialize the dev proxy; dev still does', async () => {
  let initialized = 0;
  const configure = await loadNextConfig(async () => {
    initialized += 1;
  });
  assert.equal(typeof configure, 'function');
  for (const phase of [
    'phase-production-build',
    'phase-production-server',
    'phase-export',
    'phase-test',
  ]) {
    const config = await configure(phase);
    assert.equal(await config.generateBuildId(), 'fixture-build-id');
    assert.ok(config.pageExtensions.includes('mdx'));
    assert.equal(
      config.turbopack.resolveAlias['react-native'],
      'react-native-web'
    );
    const webpack = config.webpack({ resolve: { alias: { retained: 'yes' } } });
    assert.equal(webpack.resolve.alias.retained, 'yes');
    assert.equal(webpack.resolve.alias['react-native$'], 'react-native-web');
    assert.equal(initialized, 0);
  }
  await configure('phase-development-server');
  assert.equal(initialized, 1);
});

test('Next dev initialization failures remain visible', async () => {
  const configure = await loadNextConfig(async () => {
    throw new Error('dev initialization failed');
  });
  await assert.rejects(
    configure('phase-development-server'),
    /dev initialization failed/
  );
});

async function fixture(t, filename = 'wrangler.jsonc') {
  const { experimental_readRawConfig } = await import('wrangler');
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-local-tooling-')
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { rawConfig } = experimental_readRawConfig({
    config: path.join(root, filename),
  });
  await fs.mkdir(path.join(directory, '.open-next/assets'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(directory, 'cloudflare-worker.mjs'),
    'export default { fetch() { return new Response("fixture"); } };\n'
  );
  await fs.writeFile(path.join(directory, '.dev.vars'), '');
  await fs.mkdir(path.join(directory, '.next'), { recursive: true });
  await fs.writeFile(path.join(directory, '.next/BUILD_ID'), 'fixture-build');
  await fs.writeFile(
    path.join(directory, '.next/prerender-manifest.json'),
    JSON.stringify({
      routes: { '/': { dataRoute: '/index.rsc', srcRoute: '/' } },
    })
  );
  await fs.writeFile(
    path.join(directory, '.next/app-path-routes-manifest.json'),
    JSON.stringify({ '/page': '/' })
  );
  await fs.mkdir(path.join(directory, '.open-next/cache/fixture-build'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(directory, '.open-next/cache/fixture-build/index.cache'),
    JSON.stringify({ type: 'app', html: '<h1>fixture</h1>' })
  );
  const configPath = path.join(directory, filename);
  await fs.writeFile(configPath, JSON.stringify(rawConfig));
  return { directory, configPath };
}

for (const filename of configs) {
  test(`installed Wrangler: ${filename} retains strict deployment secrets and rejects the local target`, async (t) => {
    const { unstable_readConfig: readConfig } = await import('wrangler');
    const { readDeploymentConfig } =
      await import('./cloudflare-target-config.mjs');
    const { configPath, directory } = await fixture(t, filename);
    const before = await fs.readFile(configPath, 'utf8');
    const canonical = readDeploymentConfig(configPath);
    assert.deepEqual(canonical.secrets.required, requiredSecrets);
    let generated;
    await withLocalCacheConfig(configPath, async (localPath) => {
      generated = localPath;
      assert.equal(path.dirname(localPath), directory);
      const local = readConfig({ config: localPath });
      assert.deepEqual(local.secrets.required, []);
      assert.deepEqual(local.assets, canonical.assets);
      assert.deepEqual(local.r2_buckets, canonical.r2_buckets);
      assert.throws(
        () => readDeploymentConfig(localPath),
        /Unrecognized deployment target/
      );
    });
    assert.equal(await fs.readFile(configPath, 'utf8'), before);
    await assert.rejects(fs.access(generated), { code: 'ENOENT' });
  });
}

test('temporary configuration is removed when cache preparation fails', async (t) => {
  const { configPath } = await fixture(t);
  let generated;
  await assert.rejects(
    withLocalCacheConfig(configPath, async (localPath) => {
      generated = localPath;
      throw new Error('cache failure');
    }),
    /cache failure/
  );
  await assert.rejects(fs.access(generated), { code: 'ENOENT' });
});

test('local population uses only the upstream local command and propagates process errors', async (t) => {
  const { configPath } = await fixture(t);
  const environment = { PATH: process.env.PATH };
  let calls = 0;
  let generated;
  await assert.rejects(
    populateLocalCache(configPath, {
      env: environment,
      execute(command, args, options) {
        calls += 1;
        assert.equal(command, 'pnpm');
        assert.deepEqual(args.slice(0, 4), [
          'exec',
          'opennextjs-cloudflare',
          'populateCache',
          'local',
        ]);
        assert.equal(args.length, 5);
        generated = args[4].slice('--config='.length);
        assert.equal(options.env, environment);
        assert.equal(options.stdio, 'inherit');
        return { status: 9 };
      },
    }),
    /Local OpenNext cache preparation failed/
  );
  assert.equal(calls, 1);
  await assert.rejects(fs.access(generated), { code: 'ENOENT' });
});

test('legacy Cloudflare URL stack emits no punycode deprecation', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--trace-deprecation',
      '-e',
      'const p=require("node-fetch/package.json"); if(p.version!=="2.7.0") process.exit(9); require("node-fetch");',
    ],
    {
      cwd: repo,
      encoding: 'utf8',
      timeout: 5_000,
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /DEP0040|punycode.*deprecated/i);
});

test('site navigation drains background network before browser teardown', async () => {
  const calls = [];
  await drainSiteNavigationNetwork(
    {
      async waitForLoadState(state, options) {
        calls.push({ state, options });
      },
    },
    1_234
  );

  assert.deepEqual(calls, [
    { state: 'networkidle', options: { timeout: 1_234 } },
  ]);
});

test('warning suppression is configuration-scoped, not log-filter based', async (t) => {
  const { unstable_readConfig: readConfig } = await import('wrangler');
  const { configPath } = await fixture(t);
  const canonical = readConfig({ config: configPath });
  assert.deepEqual(canonical.secrets.required, requiredSecrets);

  await withLocalCacheConfig(configPath, async (localPath) => {
    const local = readConfig({ config: localPath });
    assert.deepEqual(local.secrets.required, []);
  });

  const helper = await fs.readFile(
    path.join(root, 'scripts/cloudflare-populate-local-cache.mjs'),
    'utf8'
  );
  assert.doesNotMatch(
    helper,
    /WRANGLER_LOG|console\.(?:warn|error)\s*=|process\.stderr\.write\s*=/
  );
});

test('all maintained local-cache entry points use the helper without changing the real deployment command', async () => {
  for (const filename of [
    'ci.yml',
    'deploy-website-cloudflare-staging.yml',
    'deploy-website-cloudflare-production.yml',
    'adopt-website-cloudflare-legacy.yml',
  ]) {
    const source = await fs.readFile(
      path.join(repo, '.github/workflows', filename),
      'utf8'
    );
    assert.match(
      source,
      /node apps\/website\/scripts\/cloudflare-populate-local-cache\.mjs/
    );
    assert.doesNotMatch(source, /opennextjs-cloudflare populateCache local/);
    assert.doesNotMatch(
      source,
      /WRANGLER_LOG\s*:\s*(error|none)|BUTTONDOWN_API_KEY\s*:/
    );
  }
  const deploy = await fs.readFile(
    path.join(root, 'scripts/cloudflare-deploy.mjs'),
    'utf8'
  );
  assert.match(
    deploy,
    /await populateLocalCache\(configPath, \{ env: childProcessEnv \}\)/
  );
  assert.match(
    deploy,
    /\['exec', 'wrangler', 'deploy', `--config=\$\{configPath\}`\]/
  );
  const adoption = await fs.readFile(
    path.join(root, 'scripts/cloudflare-adopt-isolated-legacy.mjs'),
    'utf8'
  );
  assert.match(adoption, /cloudflare-populate-local-cache\.mjs/);
  const pkg = JSON.parse(
    await fs.readFile(path.join(repo, 'package.json'), 'utf8')
  );
  assert.ok(
    pkg.scripts['test:cloudflare-cache'].includes(
      'cloudflare-local-tooling.test.mjs'
    )
  );
});
