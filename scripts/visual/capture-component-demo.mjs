import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { capturePhase } from './component-demo-frames.mjs';
import {
  getDemo,
  getFrameCount,
  getStoryUrl,
  verifyDuration,
  verifyGifSize,
  verifyRevision,
} from './component-demo-policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requireFromStorybook = createRequire(
  path.join(root, 'apps/react-storybook/package.json')
);

function run(command, args, timeout = 90_000) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
  });
  if (result.status !== 0 || result.error) {
    throw new Error(
      `${command} failed: ${(result.stderr || result.error?.message || '').slice(-1500)}`
    );
  }
  return result.stdout.trim();
}

function duration(file) {
  const info = JSON.parse(run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file,
  ]));
  return Number(info.format?.duration);
}

function convertFrames(framesDir, outputMp4, outputGif, demo) {
  const source = path.join(framesDir, 'frame-%04d.png');
  const input = ['-framerate', String(demo.gifFps), '-start_number', '0', '-i', source];
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', ...input,
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium',
    '-crf', '21', '-movflags', '+faststart', '-an', outputMp4,
  ]);
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', ...input,
    '-filter_complex',
    `[0:v]scale=${demo.gifWidth}:-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5[out]`,
    '-map', '[out]', '-loop', '0', outputGif,
  ]);
  verifyGifSize(statSync(outputGif).size, demo.maxGifBytes);
  verifyDuration(duration(outputMp4), demo);
  verifyDuration(duration(outputGif), demo);
}

function fileEvidence(filePath) {
  const content = readFileSync(filePath);
  if (content.length === 0) throw new Error(`Empty demo output: ${filePath}`);
  return {
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

async function recordDropdown(page, demo, framesDir, outputPng) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('dropdown-keyboard'), {
    waitUntil: 'domcontentloaded', timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error('Local Storybook did not serve the reviewed Dropdown story.');
  }
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Layout only: render the actual Storybook story, not a copied UI control.
  await page.addStyleTag({ content: `
    body.sb-show-main { margin: 0 !important; padding: 0 !important; }
    #storybook-root { min-height: 100vh; display: grid; place-items: center; }
  ` });
  await page.evaluate(() => document.fonts.ready);
  const trigger = page.getByRole('button', { name: 'Actions' });
  await trigger.waitFor({ state: 'visible' });

  // Navigation and font loading happen BEFORE any capture. Every exported frame
  // is an inspected, post-load state of the real Dropdown interaction.
  let next = await capturePhase(page, framesDir, 0, demo.phaseFrames.ready);
  await trigger.focus();
  await page.keyboard.press('Enter');

  const menu = page.getByRole('menu', { name: 'Actions' });
  await menu.waitFor({ state: 'visible' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    throw new Error('Dropdown did not expose expanded state.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.opened, outputPng);

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => {
    const active = document.querySelector('[role="menu"]')?.getAttribute('aria-activedescendant');
    return active?.endsWith('item-1') === true;
  });
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.highlighted);

  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  const restored = await trigger.evaluate(
    (element) => document.activeElement === element && element.getAttribute('aria-expanded') === 'false'
  );
  if (!restored) throw new Error('Dropdown failed to restore focus after Escape.');
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.closed);

  if (next !== getFrameCount(demo)) throw new Error('Incomplete demo frame sequence.');
  if (errors.length > 0) {
    throw new Error(`Storybook page errors: ${errors.join('; ').slice(0, 600)}`);
  }
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
  const framesDir = path.join(temporaryDir, 'frames');
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  mkdirSync(framesDir);

  const mp4 = path.join(outputDir, `${name}.mp4`);
  const gif = path.join(outputDir, `${name}.gif`);
  const png = path.join(outputDir, `${name}.png`);

  try {
    const { chromium } = requireFromStorybook('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: demo.viewport,
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: 'reduce',
      });
      try {
        await recordDropdown(await context.newPage(), demo, framesDir, png);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }

    convertFrames(framesDir, mp4, gif, demo);
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
      frameSource: 'real-storybook-states-after-readiness',
      frames: getFrameCount(demo),
      fps: demo.gifFps,
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
