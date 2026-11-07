import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalVisualConfig } from './canonical-fonts.mjs';
import { builtStorybookConfig } from './built-storybook.mjs';

// Resolve the candidate's Playwright/config, not a second module instance from
// the separately pinned tooling checkout. No candidate file is rewritten.
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const loaded = require('./playwright.config.ts');
if (!process.env.VELLIRA_SCREENSHOT_FONT_STYLE) {
  throw new Error(
    'Canonical visual runner must prepare root-local font evidence.'
  );
}
const config = canonicalVisualConfig(
  loaded.default ?? loaded,
  root,
  process.env.VELLIRA_SCREENSHOT_FONT_STYLE,
  fileURLToPath(new URL('../../apps/react-storybook/e2e', import.meta.url))
);
export default process.env.VELLIRA_VISUAL_BUILT_STORYBOOK === '1'
  ? builtStorybookConfig(config, root)
  : config;
