import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { canonicalScreenshotFonts } from './canonical-fonts.mjs';
import { boundedVisualEnvironment } from './built-storybook.mjs';

const storybookRoot = process.cwd();
const guard = spawnSync(
  process.execPath,
  ['scripts/assert-canonical-visual-environment.mjs'],
  {
    cwd: storybookRoot,
    stdio: 'inherit',
  }
);
if (guard.status !== 0) process.exit(guard.status ?? 1);
const args = process.argv.slice(2);
const builtStorybook = args[0] === '--built-storybook';
if (builtStorybook) args.shift();
const temporary = fs.mkdtempSync(
  path.join(os.tmpdir(), 'vellira-visual-fonts-')
);
try {
  const style = path.join(temporary, 'fonts.css');
  fs.writeFileSync(
    style,
    canonicalScreenshotFonts(path.resolve(storybookRoot, '../..'))
  );
  const require = createRequire(path.join(storybookRoot, 'package.json'));
  const cli = path.join(
    path.dirname(require.resolve('playwright/package.json')),
    'cli.js'
  );
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'test',
      '--config',
      fileURLToPath(new URL('./playwright.config.mjs', import.meta.url)),
      '--grep',
      '@visual',
      ...args,
    ],
    {
      cwd: storybookRoot,
      stdio: 'inherit',
      env: {
        ...(builtStorybook
          ? boundedVisualEnvironment(process.env)
          : process.env),
        VELLIRA_SCREENSHOT_FONT_STYLE: style,
      },
    }
  );
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(temporary, { recursive: true });
}
