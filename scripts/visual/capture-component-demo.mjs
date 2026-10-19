import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  getDemo,
  getStoryUrl,
  verifyGifSize,
  verifyRevision,
} from './component-demo-policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireFromStorybook = createRequire(path.join(root, 'apps/react-storybook/package.json'));

function run(command, args, timeout = 90_000) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(`${command} failed: ${(result.stderr || result.error?.message || '').slice(-1500)}`);
  }
  return result.stdout.trim();
}

function convertVideo(input, outputMp4, outputGif, demo) {
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', '21', '-movflags', '+faststart', '-an', outputMp4,
  ]);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-filter_complex',
    `[0:v]fps=${demo.gifFps},scale=${demo.gifWidth}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5[out]`,
    '-map', '[out]', '-loop', '0', outputGif,
  ]);
  verifyGifSize(statSync(outputGif).size, demo.maxGifBytes);
}

function fileEvidence(filePath) {
  const content = readFileSync(filePath);
  if (content.length === 0) throw new Error(`Empty demo output: ${filePath}`);
  return { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') };
}

async function recordDropdown(page, outputPng) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('dropdown-keyboard'), {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  if (!response?.ok()) throw new Error('Local Storybook did not serve the reviewed Dropdown story.');
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Layout only: render the real Storybook story, not a recreated UI control.
  await page.addStyleTag({ content: `
    body.sb-show-main { margin: 0 !important; padding: 0 !important; }
    #storybook-root { min-height: 100vh; display: grid; place-items: center; }
  ` });
  await page.evaluate(() => document.fonts.ready);

  const trigger = page.getByRole('button', { name: 'Actions' });
  await trigger.waitFor({ state: 'visible' });
  await page.waitForTimeout(750);
  await trigger.focus();
  await page.keyboard.press('Enter');

  const menu = page.getByRole('menu', { name: 'Actions' });
  await menu.waitFor({ state: 'visible' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    throw new Error('Dropdown did not expose expanded state.');
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: outputPng });

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => {
    const active = document.querySelector('[role="menu"]')?.getAttribute('aria-activedescendant');
    return active?.endsWith('item-1') === true;
  });
  await page.waitForTimeout(1100);

  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  const restored = await trigger.evaluate(
    (element) => document.activeElement === element && element.getAttribute('aria-expanded') === 'false'
  );
  if (!restored) throw new Error('Dropdown failed to restore focus after Escape.');
  await page.waitForTimeout(750);
  if (errors.length > 0) throw new Error(`Storybook page errors: ${errors.join('; ').slice(0, 600)}`);
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error('Usage: node scripts/visual/capture-component-demo.mjs dropdown-keyboard');
  }
  const name = process.argv[2];
  const demo = getDemo(name);
  const sha = run('git', ['rev-parse', 'HEAD']);
  verifyRevision(sha, process.env.VELLIRA_DEMO_EXPECTED_SHA);

  const outputDir = path.join(root, 'apps/react-storybook/test-results/component-demo', name);
  const temporaryDir = mkdtempSync(path.join(os.tmpdir(), 'vellira-component-demo-'));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const mp4 = path.join(outputDir, `${name}.mp4`);
  const gif = path.join(outputDir, `${name}.gif`);
  const png = path.join(outputDir, `${name}.png`);

  try {
    const { chromium } = requireFromStorybook('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    let source;
    try {
      const context = await browser.newContext({
        viewport: demo.viewport,
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: 'reduce',
        recordVideo: { dir: temporaryDir, size: demo.viewport },
      });
      let video;
      try {
        const page = await context.newPage();
        video = page.video();
        if (!video) throw new Error('Playwright video recording was not enabled.');
        await recordDropdown(page, png);
      } finally {
        await context.close();
      }
      source = await video.path();
    } finally {
      await browser.close();
    }

    convertVideo(source, mp4, gif, demo);
    const manifest = {
      schemaVersion: 1,
      demo: name,
      storyId: demo.storyId,
      title: demo.title,
      commitSha: sha,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      generatedAt: new Date().toISOString(),
      publishing: 'manual-review-required',
      files: {
        [`${name}.mp4`]: fileEvidence(mp4),
        [`${name}.gif`]: fileEvidence(gif),
        [`${name}.png`]: fileEvidence(png),
      },
    };
    writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Demo captured from ${demo.storyId} at ${sha}.`);
    console.log(`Artifacts: ${outputDir}`);
  } catch (error) {
    rmSync(outputDir, { recursive: true, force: true });
    throw error;
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
}

await main();
