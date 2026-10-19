import { capturePhase } from './component-demo-frames.mjs';
import { getFrameCount, getStoryUrl } from './component-demo-policy.mjs';
import { getSocialCrop } from './component-demo-social.mjs';

// Uses the maintained Button Storybook composition. The confirmation dialog
// is local example state: it performs no workspace deletion or network write.
export async function recordButtonConfirmation(page, demo, framesDir, posterPath) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('button-confirmation'), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error('Local Storybook did not serve the reviewed Button story.');
  }
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Composition-only positioning keeps the existing Button stable when the
  // confirmation panel is mounted and removed; no component styles are copied.
  await page.addStyleTag({ content: `
    body.sb-show-main { margin: 0 !important; padding: 0 !important; }
    #storybook-root { min-height: 100vh; display: block; }
    #storybook-root > div {
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 80px !important;
    }
    #storybook-root section { width: 560px; }
  ` });
  await page.evaluate(() => document.fonts.ready);

  const opener = page.getByRole('button', { name: 'Delete workspace' });
  await opener.waitFor({ state: 'visible' });
  if (await opener.isDisabled()) throw new Error('Button trigger is unexpectedly disabled.');

  let next = await capturePhase(page, framesDir, 0, demo.phaseFrames.ready);
  await opener.focus();
  await page.keyboard.press('Enter');

  const group = page.getByRole('group');
  await group.waitFor({ state: 'visible' });
  const deleteButton = group.getByRole('button', { name: 'Delete', exact: true });
  const cancelButton = group.getByRole('button', { name: 'Cancel', exact: true });
  await deleteButton.waitFor({ state: 'visible' });
  if (await deleteButton.isDisabled() || await cancelButton.isDisabled()) {
    throw new Error('Confirmation actions must initially be interactive.');
  }
  const crop = getSocialCrop(
    await opener.boundingBox(),
    await group.boundingBox(),
    demo.viewport
  );
  next = await capturePhase(
    page, framesDir, next, demo.phaseFrames.confirming, posterPath
  );

  await deleteButton.focus();
  await page.keyboard.press('Enter');
  const loading = group.getByRole('button', { name: 'Deleting...', exact: true });
  await loading.waitFor({ state: 'visible' });
  if ((await loading.getAttribute('aria-busy')) !== 'true' ||
      !(await loading.isDisabled())) {
    throw new Error('Button loading state did not disable and mark itself busy.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.loading);

  await group.waitFor({ state: 'hidden', timeout: 5000 });
  await opener.waitFor({ state: 'visible' });
  if (await opener.isDisabled()) {
    throw new Error('Button did not return to its original enabled state.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.closed);

  if (next !== getFrameCount(demo)) {
    throw new Error('Incomplete Button confirmation proof frames.');
  }
  if (errors.length > 0) {
    throw new Error(`Button Storybook page errors: ${errors.join('; ').slice(0, 600)}`);
  }
  return crop;
}
