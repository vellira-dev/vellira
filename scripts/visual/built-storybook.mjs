import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The production validator already requires a successful candidate Storybook
// build. Existence is a prerequisite here, never proof of visual acceptance.
export function builtStorybookDirectory(root) {
  const directory = path.join(root, 'storybook-static');
  if (!fs.lstatSync(directory).isDirectory()) {
    throw new Error('Built Storybook must be a root-local directory.');
  }
  for (const name of ['index.html', 'iframe.html', 'index.json']) {
    const stat = fs.lstatSync(path.join(directory, name));
    if (!stat.isFile() || stat.size === 0) {
      throw new Error(`Missing regular built Storybook artifact: ${name}`);
    }
  }
  return directory;
}

export function boundedVisualEnvironment(environment) {
  return {
    ...environment,
    NODE_OPTIONS: `${environment.NODE_OPTIONS ?? ''} --v8-pool-size=1`.trim(),
    UV_THREADPOOL_SIZE: '1',
    GOMAXPROCS: '2',
    VELLIRA_VISUAL_BUILT_STORYBOOK: '1',
  };
}

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function builtStorybookConfig(config, root) {
  builtStorybookDirectory(root);
  const server = config.webServer;
  if (!server || Array.isArray(server) || typeof server.url !== 'string') {
    throw new Error(
      'Built Storybook requires one explicit loopback web server.'
    );
  }
  const url = new URL(server.url);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    !url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Built Storybook requires an HTTP loopback origin with a port.'
    );
  }
  return {
    ...config,
    workers: 1,
    webServer: {
      ...server,
      cwd: root,
      command: `${shellQuote(process.execPath)} ${shellQuote(fileURLToPath(import.meta.url))} ${url.port}`,
      reuseExistingServer: false,
    },
  };
}

async function serveBuiltStorybook() {
  const root = process.cwd();
  const outDir = builtStorybookDirectory(root);
  const port = Number(process.argv[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid built Storybook port.');
  }
  const require = createRequire(path.join(root, 'package.json'));
  const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
  const server = await preview({
    configFile: false,
    root,
    build: { outDir },
    preview: { host: '127.0.0.1', port, strictPort: true, open: false },
    logLevel: 'error',
  });
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, async () => {
      await server.close();
      process.exit(0);
    });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await serveBuiltStorybook();
}
