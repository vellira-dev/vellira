import { capturePhase } from './component-demo-frames.mjs';
import { getFrameCount, getStoryUrl } from './component-demo-policy.mjs';
import { getSocialCrop } from './component-demo-social.mjs';

// Uses the maintained Components/Tabs/Controlled Storybook example.
// Every captured state follows real keyboard input and a browser assertion.
export async function recordTabsKeyboard(page, demo, framesDir, posterPath) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(getStoryUrl('tabs-keyboard'), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  if (!response?.ok()) {
    throw new Error('Local Storybook did not serve reviewed Tabs/Controlled.');
  }
  await page.locator('#storybook-root').waitFor({ state: 'visible' });

  // Presentation-only layout: the canonical Tabs implementation, role, focus,
  // indicator and panels remain owned by the actual Storybook story.
  await page.addStyleTag({ content: [
    'body.sb-show-main { margin: 0 !important; padding: 0 !important; }',
    '#storybook-root { min-height: 100vh; }',
    '#storybook-root > div { display: flex; align-items: flex-start;',
    '  justify-content: center; padding: 106px 24px 24px !important; }',
    '#storybook-root section { width: 610px; margin: 0 auto; }',
  ].join('\n') });
  await page.evaluate(() => document.fonts.ready);

  const storySection = page.locator('#storybook-root section');
  await storySection.waitFor({ state: 'visible' });
  const tabs = page.getByRole('tablist', { name: 'Controlled account sections' });
  const home = tabs.getByRole('tab', { name: 'Home', exact: true });
  const profile = tabs.getByRole('tab', { name: 'Profile', exact: true });
  const settings = tabs.getByRole('tab', { name: 'Settings', exact: true });
  const valueLine = storySection.locator('p').filter({ hasText: 'Current value:' });
  await home.waitFor({ state: 'visible' });

  async function assertState(tab, value, panelLabel, panelText) {
    const panel = page.getByRole('tabpanel', { name: panelLabel, exact: true });
    await panel.waitFor({ state: 'visible' });
    await page.waitForFunction(({ selectedText, expectedValue }) => {
      const active = Array.from(document.querySelectorAll('[role="tab"]'))
        .find((element) => element.textContent?.trim() === selectedText);
      const value = Array.from(document.querySelectorAll('p'))
        .find((element) => element.textContent?.includes('Current value:'));
      return active?.getAttribute('aria-selected') === 'true' &&
        document.activeElement === active &&
        value?.textContent?.includes('Current value: ' + expectedValue) === true;
    }, { selectedText: panelLabel, expectedValue: value });
    if ((await tab.getAttribute('aria-selected')) !== 'true' ||
        !(await tab.evaluate((element) => element === document.activeElement)) ||
        !(await panel.textContent())?.includes(panelText) ||
        !(await valueLine.textContent())?.includes(value)) {
      throw new Error('Tabs did not update its actual selected tab, focus and panel.');
    }
    const selected = await tabs.locator('[role="tab"][aria-selected="true"]').count();
    if (selected !== 1) throw new Error('Tabs must have one selected trigger.');
  }

  await home.focus();
  await assertState(home, 'home', 'Home', 'Home content');
  const sectionBox = await storySection.boundingBox();
  const crop = getSocialCrop(sectionBox, sectionBox, demo.viewport);
  let next = await capturePhase(page, framesDir, 0, demo.phaseFrames.ready);

  await page.keyboard.press('ArrowRight');
  await assertState(profile, 'profile', 'Profile', 'Profile content');
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.profile);

  await page.keyboard.press('ArrowRight');
  await assertState(settings, 'settings', 'Settings', 'Settings content');
  next = await capturePhase(
    page, framesDir, next, demo.phaseFrames.settings, posterPath
  );

  await page.keyboard.press('Home');
  await assertState(home, 'home', 'Home', 'Home content');
  next = await capturePhase(page, framesDir, next, demo.phaseFrames.restored);

  if (next !== getFrameCount(demo)) {
    throw new Error('Incomplete verified Tabs keyboard frame sequence.');
  }
  if (errors.length) {
    throw new Error('Tabs Storybook page errors: ' + errors.join('; ').slice(0, 600));
  }
  return crop;
}
