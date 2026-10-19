import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const SOCIAL_PROFILE = Object.freeze({
  name: 'square-1200-v1',
  width: 1200,
  height: 1200,
  fps: 12,
  fadeSeconds: 0.25,
  maxGifBytes: 8 * 1024 * 1024,
});

const STAGES = Object.freeze([
  Object.freeze({ name: 'ready', label: '01 / READY', key: 'ENTER', action: 'Open the menu' }),
  Object.freeze({ name: 'opened', label: '02 / OPEN', key: 'ENTER', action: 'Menu opens' }),
  Object.freeze({ name: 'highlighted', label: '03 / NAVIGATE', key: 'ARROW DOWN', action: 'Move through actions' }),
  Object.freeze({ name: 'closed', label: '04 / CLOSE', key: 'ESC', action: 'Focus returns to trigger' }),
]);

const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function inViewport(box, viewport) {
  return (
    box &&
    [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
    box.width > 0 &&
    box.height > 0 &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= viewport.width + 1 &&
    box.y + box.height <= viewport.height + 1
  );
}

export function getSocialCrop(trigger, menu, viewport) {
  if (!viewport || !Number.isSafeInteger(viewport.width) || !Number.isSafeInteger(viewport.height)) {
    throw new Error('Demo viewport dimensions are invalid.');
  }
  if (!inViewport(trigger, viewport) || !inViewport(menu, viewport)) {
    throw new Error('Dropdown interaction geometry must be contained in the proof viewport.');
  }
  const x = Math.max(0, Math.floor(Math.min(trigger.x, menu.x) - 44));
  const y = Math.max(0, Math.floor(Math.min(trigger.y, menu.y) - 42));
  const right = Math.min(viewport.width, Math.ceil(Math.max(trigger.x + trigger.width, menu.x + menu.width) + 44));
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(trigger.y + trigger.height, menu.y + menu.height) + 42));
  const width = right - x;
  const height = bottom - y;
  if (width < 180 || height < 150 || width > 740 || height > 500) {
    throw new Error('Unexpected Dropdown interaction crop; refusing social output.');
  }
  return Object.freeze({ x, y, width, height });
}

export function getSocialStages(demo) {
  if (!demo || !demo.phaseFrames || !Number.isSafeInteger(demo.gifFps) || demo.gifFps <= 0) {
    throw new Error('Missing reviewed frame plan for social output.');
  }
  let frameIndex = 0;
  return STAGES.map((stage) => {
    const frames = demo.phaseFrames[stage.name];
    if (!Number.isSafeInteger(frames) || frames <= 0) {
      throw new Error('Unreviewed or incomplete social state sequence.');
    }
    const value = { ...stage, startFrame: frameIndex, frames };
    frameIndex += frames;
    return value;
  });
}

export function getSocialXfadePlan(demo, profile = SOCIAL_PROFILE) {
  const stages = getSocialStages(demo);
  if (profile.fps !== demo.gifFps || profile.fadeSeconds <= 0 || profile.fadeSeconds >= 0.4) {
    throw new Error('Invalid social frame rate or transition budget.');
  }
  const inputDurations = stages.map((stage, index) =>
    stage.frames / profile.fps + (index < stages.length - 1 ? profile.fadeSeconds : 0)
  );
  const offsets = stages.slice(1).map((_, index) =>
    inputDurations.slice(0, index + 1).reduce((a, b) => a + b, 0) -
    (index + 1) * profile.fadeSeconds
  );
  const expectedDuration = stages.reduce((n, x) => n + x.frames, 0) / profile.fps;
  return { stages, inputDurations, offsets, expectedDuration };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

export function requireImagePng(file, viewport) {
  const content = readFileSync(file);
  if (content.length <= 24 || !content.subarray(0, 8).equals(PNG_HEADER)) {
    throw new Error('Social renderer accepts only real proof PNG frames.');
  }
  const width = content.readUInt32BE(16);
  const height = content.readUInt32BE(20);
  if (width !== viewport.width || height !== viewport.height) {
    throw new Error('Proof screenshot dimensions do not match the reviewed Storybook viewport.');
  }
  return content.toString('base64');
}

export function getSocialMarkup({ demo, stage, crop, imageBase64, logoBase64, fontRegular, fontBold }) {
  if (!STAGES.some((value) => value.name === stage?.name && value.key === stage.key && value.label === stage.label && value.action === stage.action) || !/^[A-Za-z0-9+/]+=*$/.test(imageBase64)) {
    throw new Error('Unknown social stage or invalid proof image.');
  }
  const { width, height } = demo.viewport;
  const scale = Math.min(2.65, 790 / crop.width, 430 / crop.height);
  const cropWidth = Math.round(crop.width * scale);
  const cropHeight = Math.round(crop.height * scale);
  const imageWidth = (width * scale).toFixed(3);
  const imageHeight = (height * scale).toFixed(3);
  const imageLeft = (-crop.x * scale).toFixed(3);
  const imageTop = (-crop.y * scale).toFixed(3);
  const title = escapeHtml(demo.title.split(' — ')[0].replace(/^Vellira /, ''));
  const label = escapeHtml(stage.label);
  const key = escapeHtml(stage.key);
  const action = escapeHtml(stage.action);
  const safeLogo = logoBase64 ? `<img class="brand-logo" src="data:image/svg+xml;base64,${logoBase64}" alt="Vellira" />` : '<span class="brand-text">VELLIRA</span>';
  const fonts = fontRegular && fontBold ? `
    @font-face { font-family: 'Vellira Sans'; src: url(data:font/woff2;base64,${fontRegular}) format('woff2'); font-weight: 400; font-display: block; }
    @font-face { font-family: 'Vellira Sans'; src: url(data:font/woff2;base64,${fontBold}) format('woff2'); font-weight: 700; font-display: block; }
  ` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
${fonts}
* { box-sizing: border-box; }
html, body { margin: 0; width: 1200px; height: 1200px; overflow: hidden; }
body { font-family: 'Vellira Sans', ui-sans-serif, Arial, sans-serif; }
.social-scene { position: relative; width: 1200px; height: 1200px; color: #f4f1fb;
  background: radial-gradient(circle at 85% 2%, rgba(145,75,243,.23), transparent 41%),
              radial-gradient(circle at 6% 94%, rgba(59,46,240,.19), transparent 37%),
              linear-gradient(148deg, #231f31, #181521 75%); overflow: hidden; }
.social-scene::before { content: ''; position: absolute; inset: 22px; border: 1px solid rgba(167,139,250,.18); border-radius: 32px; pointer-events: none; }
.header { position: absolute; top: 88px; left: 96px; right: 96px; display: flex; align-items: center; justify-content: space-between; }
.brand-logo { display: block; width: 238px; height: auto; }
.brand-text { font-weight: 700; letter-spacing: .18em; color: #a78bfa; font-size: 33px; }
.tag { color: #d4cee8; font-size: 20px; border: 1px solid rgba(187,178,210,.38); border-radius: 100px; padding: 12px 22px; letter-spacing: .06em; }
.title { position: absolute; top: 181px; left: 96px; font-size: 80px; font-weight: 700; letter-spacing: -.045em; line-height: 1.15; }
.subtitle { position: absolute; top: 286px; left: 100px; color: #d4cee8; font-size: 25px; }
.demo-card { position: absolute; left: 94px; top: 390px; width: 1012px; height: 600px;
  border-radius: 32px; background: #faf8ff; overflow: hidden; box-shadow: 0 32px 70px rgba(0,0,0,.3); }
.demo-card::before { content: ''; position: absolute; inset: 0; z-index: 1; border: 1px solid #e4ddf4; border-radius: 32px; pointer-events: none; }
.demo-meta { position: absolute; top: 32px; left: 45px; right: 45px; display: flex; align-items: center; justify-content: space-between; color: #6b6386; font-size: 18px; font-weight: 700; letter-spacing: .055em; }
.meta-dot { display: inline-block; width: 10px; height: 10px; margin-right: 12px; border-radius: 50%; background: #7352f8; }
.demo-stage { position: absolute; left: 0; right: 0; top: 88px; height: 430px; display: flex; justify-content: center; align-items: center; }
.capture-window { position: relative; width: ${cropWidth}px; height: ${cropHeight}px; overflow: hidden; border-radius: 18px;
  background: #fff; box-shadow: 0 12px 32px rgba(47,42,66,.07); }
.capture-image { position: absolute; width: ${imageWidth}px; height: ${imageHeight}px; left: ${imageLeft}px; top: ${imageTop}px; max-width: none; }
.demo-status { position: absolute; bottom: 30px; left: 43px; right: 43px; display: flex; align-items: center; gap: 17px; color: #3d3754; }
.stage-label { font-size: 15px; letter-spacing: .07em; font-weight: 700; color: #6b6386; margin-right: auto; }
.key { padding: 10px 17px; border: 1px solid #d4ccff; background: #eee8fa; color: #5037c8; font-size: 20px; font-weight: 700; border-radius: 12px; }
.action { color: #3d3754; font-size: 20px; font-weight: 700; }
.footer { position: absolute; left: 100px; right: 100px; top: 1042px; display: flex; align-items: center; justify-content: space-between; }
.footer-label { color: #d4cee8; font-size: 22px; }
.footer-url { color: #b8a8ff; font-size: 22px; font-weight: 700; }
</style></head><body>
<main class="social-scene">
  <header class="header">${safeLogo}<div class="tag">REACT / STORYBOOK</div></header>
  <div class="title">${title}</div>
  <div class="subtitle">Keyboard navigation and Escape handling</div>
  <section class="demo-card" aria-label="Verified component capture">
    <div class="demo-meta"><span><span class="meta-dot"></span>REAL COMPONENT INTERACTION</span><span>WEB / LIGHT</span></div>
    <div class="demo-stage"><div class="capture-window">
      <img class="capture-image" src="data:image/png;base64,${imageBase64}" alt="Real Storybook Dropdown" />
    </div></div>
    <div class="demo-status"><span class="stage-label">${label}</span><span class="key">${key}</span><span class="action">${action}</span></div>
  </section>
  <footer class="footer"><span class="footer-label">Built with Vellira</span><span class="footer-url">storybook.vellira.dev</span></footer>
</main></body></html>`;
}

export async function renderSocialStages({ browser, demo, sourceFramesDir, tempDir, outputDir, crop, root }) {
  const profile = SOCIAL_PROFILE;
  const { stages } = getSocialXfadePlan(demo, profile);
  const logo = readFileSync(path.join(root, 'marketing/media-kit/logos/vellira-dark.svg'), 'utf8');
  if (!logo.includes('<svg') || /<script\b|<image\b|https?:\/\//i.test(logo.replace('http://www.w3.org/2000/svg', ''))) {
    throw new Error('Canonical logo cannot contain remote content or scripts.');
  }
  const logoBase64 = Buffer.from(logo).toString('base64');
  const fontRegular = readFileSync(path.join(root, 'packages/assets/fonts/VelliraSans-Regular.woff2')).toString('base64');
  const fontBold = readFileSync(path.join(root, 'packages/assets/fonts/VelliraSans-Bold.woff2')).toString('base64');
  const socialTemp = path.join(tempDir, 'social-phases');
  const socialOut = path.join(outputDir, 'social');
  mkdirSync(socialTemp, { recursive: true });
  mkdirSync(socialOut, { recursive: true });
  const page = await browser.newPage({ viewport: { width: profile.width, height: profile.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  try {
    for (const stage of stages) {
      const source = path.join(sourceFramesDir, `frame-${String(stage.startFrame).padStart(4, '0')}.png`);
      const markup = getSocialMarkup({ demo, stage, crop, imageBase64: requireImagePng(source, demo.viewport), logoBase64, fontRegular, fontBold });
      await page.setContent(markup, { waitUntil: 'load', timeout: 30_000 });
      await page.evaluate(async () => {
        await document.fonts.load('700 80px "Vellira Sans"');
        await document.fonts.load('400 24px "Vellira Sans"');
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map((image) => image.decode()));
      });
      if (!(await page.evaluate(() => document.fonts.check('700 80px "Vellira Sans"')))) {
        throw new Error('Vellira brand font did not load for social capture.');
      }
      await page.screenshot({ path: path.join(socialTemp, `${stage.name}.png`), animations: 'disabled' });
      if (stage.name === 'opened') {
        await page.screenshot({ path: path.join(socialOut, 'dropdown-keyboard-social.png'), animations: 'disabled' });
      }
    }
  } finally {
    await page.close();
  }
  return { socialTemp, socialOut };
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 180_000 });
  if (result.status !== 0 || result.error) {
    throw new Error(`${command} social encoding failed: ${(result.stderr || result.error?.message || '').slice(-1800)}`);
  }
  return result.stdout.trim();
}

function ffprobe(file) {
  const result = runCommand('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', file,
  ]);
  const info = JSON.parse(result);
  const stream = info.streams?.find((x) => Number.isSafeInteger(x.width));
  return { duration: Number(info.format?.duration), width: stream?.width, height: stream?.height };
}

export function encodeSocialMedia({ demo, socialTemp, socialOut }) {
  const profile = SOCIAL_PROFILE;
  const plan = getSocialXfadePlan(demo, profile);
  const inputs = [];
  for (let i = 0; i < plan.stages.length; i++) {
    inputs.push('-framerate', String(profile.fps), '-loop', '1', '-t', plan.inputDurations[i].toFixed(6), '-i', path.join(socialTemp, `${plan.stages[i].name}.png`));
  }
  const filters = plan.stages.map((_, index) => `[${index}:v]fps=${profile.fps},format=yuv420p,settb=AVTB[v${index}]`);
  let previous = 'v0';
  for (let i = 1; i < plan.stages.length; i++) {
    const next = `x${i}`;
    filters.push(`[${previous}][v${i}]xfade=transition=fade:duration=${profile.fadeSeconds}:offset=${plan.offsets[i - 1].toFixed(6)}[${next}]`);
    previous = next;
  }
  const mp4 = path.join(socialOut, 'dropdown-keyboard-social.mp4');
  const gif = path.join(socialOut, 'dropdown-keyboard-social.gif');
  runCommand('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', ...inputs,
    '-filter_complex', filters.join(';'), '-map', `[${previous}]`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4,
  ]);
  runCommand('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', mp4,
    '-filter_complex', '[0:v]fps=12,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5[out]',
    '-map', '[out]', '-loop', '0', gif,
  ]);
  const media = [mp4, gif, path.join(socialOut, 'dropdown-keyboard-social.png')];
  for (const file of media) {
    if (statSync(file).size <= 0) throw new Error('Empty social render: ' + file);
  }
  if (statSync(gif).size > profile.maxGifBytes) throw new Error('Social GIF exceeds reviewed 8 MiB limit.');
  for (const file of [mp4, gif]) {
    const probe = ffprobe(file);
    if (probe.width !== profile.width || probe.height !== profile.height ||
      Math.abs(probe.duration - plan.expectedDuration) > 0.4) {
      throw new Error(`Social media format/duration mismatch: ${JSON.stringify(probe)}`);
    }
  }
  return {
    profile: profile.name,
    width: profile.width,
    height: profile.height,
    phaseOrder: plan.stages.map((x) => x.name),
    frameSource: 'verified-storybook-proof-frames',
    files: Object.fromEntries(media.map((file) => {
      const content = readFileSync(file);
      return [`social/${path.basename(file)}`, { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') }];
    })),
  };
}
