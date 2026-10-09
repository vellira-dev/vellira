import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const storybook = 'apps/react-storybook/scripts';
const baseline = [
  'cloudflare-browser-diagnostics.mjs',
  'cloudflare-browser-diagnostics.test.mjs',
  'cloudflare-blog-metrics-smoke-policy.mjs',
  'cloudflare-blog-metrics-smoke-policy.test.mjs',
  'cloudflare-navigation-soak.mjs',
  'cloudflare-website-smoke.mjs',
];

export function cloudflareCandidateCommand(root, mode) {
  if (!['lint', 'test'].includes(mode))
    throw new Error('Unknown Cloudflare source-check profile.');
  const requireFile = (name) => {
    if (
      !fs.existsSync(path.join(root, name)) ||
      !fs.lstatSync(path.join(root, name)).isFile()
    ) {
      throw new Error(`Required Cloudflare source check is missing: ${name}`);
    }
    return name;
  };
  baseline.forEach((name) => requireFile(`${storybook}/${name}`));
  const recovery = fs
    .readdirSync(path.join(root, storybook))
    .filter((name) => /^cloudflare-.*recovery(?:\.test)?\.mjs$/.test(name))
    .sort();
  const featurePolicies = [
    ...recovery.map((name) => `${storybook}/${name}`),
    ...fs
      .readdirSync(path.join(root, 'apps/website/scripts'))
      .filter((name) => /^cloudflare-edge-fetch(?:\.test)?\.mjs$/.test(name))
      .sort()
      .map((name) => `apps/website/scripts/${name}`),
  ];
  for (const name of featurePolicies) {
    requireFile(name);
    const pair = name.endsWith('.test.mjs')
      ? name.replace('.test.mjs', '.mjs')
      : name.replace('.mjs', '.test.mjs');
    requireFile(pair);
  }
  if (mode === 'test') {
    return [
      process.execPath,
      '--test',
      `${storybook}/cloudflare-blog-metrics-smoke-policy.test.mjs`,
      ...featurePolicies.filter((name) => name.endsWith('.test.mjs')),
    ];
  }
  const family = (directory) => {
    const files = fs
      .readdirSync(path.join(root, directory))
      .filter((name) => name.endsWith('.mjs'))
      .sort();
    if (!files.length)
      throw new Error(`Cloudflare lint family is empty: ${directory}`);
    return files.map((name) => requireFile(`${directory}/${name}`));
  };
  return [
    'pnpm',
    'exec',
    'eslint',
    requireFile('apps/website/cloudflare-worker.mjs'),
    ...family('apps/website/cloudflare'),
    ...family('apps/website/scripts'),
    ...[...baseline, ...recovery].map((name) => `${storybook}/${name}`),
  ];
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const [command, ...args] = cloudflareCandidateCommand(
      process.cwd(),
      process.argv[2]
    );
    console.log(
      JSON.stringify({
        profile: process.argv[2],
        candidate: process.env.VELLIRA_CANDIDATE_SHA,
        tooling: process.env.VELLIRA_CI_TOOLING_SHA,
        command: [command, ...args],
      })
    );
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
