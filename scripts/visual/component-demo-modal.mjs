import { capturePhase } from './component-demo-frames.mjs';
import { getFrameCount, getStoryUrl } from './component-demo-policy.mjs';
import { getSocialCrop } from './component-demo-social.mjs';

// Records the maintained Modal/Default story, never a local dialog substitute.
// Opening, focus traversal and Escape are real browser interactions.
export async function recordModalFocus(page, demo, framesDir, posterPath) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('modal-focus'), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error('Local Storybook did not serve the reviewed Modal story.');
  }
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Storybook presentation layout only. No owned Modal styling or behavior
  // is replaced; its actual portal still renders at the document root.
  await page.addStyleTag({ content: `
    body.sb-show-main { margin: 0 !important; padding: 0 !important; }
    #storybook-root { min-height: 100vh; }
    #storybook-root > div {
      display: flex; align-items: center; justify-content: center;
      padding: 24px !important;
    }
    #storybook-root section { width: 430px; }
  ` });
  await page.evaluate(() => document.fonts.ready);

  const opener = page.getByRole('button', { name: 'Open modal' });
  await opener.waitFor({ state: 'visible' });
  if (await opener.isDisabled()) throw new Error('Modal trigger is disabled.');

  const openerBox = await opener.boundingBox();
  let next = await capturePhase(page, framesDir, 0, demo.phaseFrames.ready);
  await opener.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
  await dialog.waitFor({ state: 'visible' });
  if ((await dialog.getAttribute('aria-modal')) !== 'true') {
    throw new Error('Modal must expose aria-modal=true.');
  }
  if (await page.locator('#storybook-root [role="dialog"]').count()) {
    throw new Error('Modal must render through the maintained Portal.');
  }

  const close = dialog.getByRole('button', { name: 'Close dialog' });
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  await close.waitFor({ state: 'visible' });
  await cancel.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const close = dialog?.querySelector('button[aria-label="Close dialog"]');
    return Boolean(close && document.activeElement === close);
  });
  await page.waitForTimeout(220);

  // A centered modal is a different composition from a small Dropdown menu.
  // A union with its background trigger can exceed the reviewed menu crop cap.
  // Frame the *actual portaled dialog* and confirm the ready trigger stays visible.
  const dialogBox = await dialog.boundingBox();
  const crop = getSocialCrop(dialogBox, dialogBox, demo.viewport);
  const openerCenter = {
    x: openerBox.x + openerBox.width / 2,
    y: openerBox.y + openerBox.height / 2,
  };
  if (
    openerCenter.x < crop.x ||
    openerCenter.x > crop.x + crop.width ||
    openerCenter.y < crop.y ||
    openerCenter.y > crop.y + crop.height
  ) {
    throw new Error(
      `Modal trigger is outside approved dialog crop: ${JSON.stringify({
        openerBox, dialogBox, crop,
      })}`
    );
  }
  next = await capturePhase(
    page, framesDir, next, demo.phaseFrames.opened, posterPath
  );

  await page.keyboard.press('Tab');
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
    const cancel = Array.from(dialog?.querySelectorAll('button') ?? [])
      .find((button) => button.textContent?.trim() === 'Cancel');
    return Boolean(cancel && document.activeElement === cancel);
  });
  if (!(await dialog.isVisible())) {
    throw new Error('Dialog unexpectedly closed during keyboard traversal.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.focused);

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  await page.waitForFunction(() => {
    const opener = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Open modal');
    return Boolean(opener && document.activeElement === opener);
  });
  if (await opener.isDisabled()) {
    throw new Error('Modal failed to restore enabled trigger state.');
  }
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.closed);

  if (next !== getFrameCount(demo)) {
    throw new Error('Incomplete Modal focus proof frames.');
  }
  if (errors.length) {
    throw new Error(`Modal Storybook page errors: ${errors.join('; ').slice(0, 600)}`);
  }
  return crop;
}
