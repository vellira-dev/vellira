import { capturePhase } from './component-demo-frames.mjs';
import { getFrameCount, getStoryUrl } from './component-demo-policy.mjs';
import { getSocialCrop } from './component-demo-social.mjs';

// The maintained Components/Select/SimpleUsage story owns every control pixel.
export async function recordSelectKeyboard(page, demo, framesDir, posterPath) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('select-keyboard'), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error('Local Storybook did not serve the reviewed Select story.');
  }
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Center only the Storybook example; preserve the canonical Select Portal.
  await page.addStyleTag({ content: [
    'body.sb-show-main { margin: 0 !important; padding: 0 !important; }',
    '#storybook-root { min-height: 100vh; }',
    '#storybook-root section { width: 430px; margin: 0 auto; }',
  ].join('\n') });
  await page.evaluate(() => document.fonts.ready);

  const trigger = page.getByRole('combobox');
  await trigger.waitFor({ state: 'visible' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'false') {
    throw new Error('Select must start collapsed.');
  }
  if (!(await trigger.textContent())?.includes('Country')) {
    throw new Error('Select must start with the reviewed Country placeholder.');
  }

  let next = await capturePhase(page, framesDir, 0, demo.phaseFrames.ready);
  await trigger.focus();
  await page.keyboard.press('Enter');

  const listbox = page.getByRole('listbox');
  await listbox.waitFor({ state: 'visible' });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true' ||
      !(await trigger.evaluate((element) => document.activeElement === element))) {
    throw new Error('Select did not open while retaining trigger focus.');
  }
  if (await page.locator('#storybook-root [role="listbox"]').count()) {
    throw new Error('Select did not use the maintained Portal.');
  }
  await listbox.getByRole('option', { name: 'Germany', exact: true })
    .waitFor({ state: 'visible' });

  const crop = getSocialCrop(
    await trigger.boundingBox(),
    await listbox.boundingBox(),
    demo.viewport
  );
  next = await capturePhase(
    page, framesDir, next, demo.phaseFrames.opened, posterPath
  );

  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[role="combobox"]');
    return trigger?.getAttribute('aria-activedescendant')?.endsWith('-option-1') === true;
  });
  const optionId = await trigger.getAttribute('aria-activedescendant');
  if (!optionId?.endsWith('-option-1') ||
      !(await listbox.getByRole('option', { name: 'Germany', exact: true }).isVisible())) {
    throw new Error('Select did not highlight the second reviewed option.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.highlighted);

  await page.keyboard.press('Enter');
  await listbox.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => {
    const trigger = document.querySelector('[role="combobox"]');
    return trigger?.getAttribute('aria-expanded') === 'false' &&
      document.activeElement === trigger &&
      trigger.textContent?.includes('Germany') === true;
  });
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.selected);

  if (next !== getFrameCount(demo)) {
    throw new Error('Incomplete Select keyboard proof frames.');
  }
  if (errors.length) {
    throw new Error('Select Storybook page errors: ' + errors.join('; ').slice(0, 600));
  }
  return crop;
}
