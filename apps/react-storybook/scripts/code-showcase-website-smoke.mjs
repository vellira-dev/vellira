import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL ?? 'http://127.0.0.1:3101';
const artifactDir = 'test-results/code-showcase';
const examples = ['Button', 'Input', 'Modal', 'Dropdown'];
const browser = await chromium.launch({ headless: true });
const evidence = [];

await mkdir(artifactDir, { recursive: true });

async function checkGeometry(control) {
  // These are the existing CodeShowcase CSS values, not standard Button sizes.
  await expect(control).toHaveCSS('height', '36px');
  await expect(control).toHaveCSS('min-height', '36px');
  await expect(control).toHaveCSS('padding-left', '14px');
  await expect(control).toHaveCSS('padding-right', '14px');
  await expect(control).toHaveCSS('font-size', '12px');
  await expect(control).toHaveCSS('font-weight', '600');
  await expect(control).toHaveCSS('border-top-width', '1px');
  await expect(control).toHaveCSS('transform', 'none');
}

async function ensurePickerPainted(picker) {
  await picker.evaluate((element) =>
    element.scrollIntoView({
      behavior: 'instant',
      block: 'center',
      inline: 'center',
    })
  );
  await expect(picker).toBeInViewport();
  await expect
    .poll(
      () =>
        picker.evaluate((element) => {
          for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              Number(style.opacity) < 1 ||
              style.visibility !== 'visible' ||
              style.display === 'none'
            )
              return false;
          }
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          );
          return hit !== null && (hit === element || element.contains(hit));
        }),
      { message: 'Picker must be fully painted and unobscured', timeout: 15000 }
    )
    .toBe(true);
}

try {
  for (const reducedMotion of ['reduce', 'no-preference']) {
    for (const colorScheme of ['light', 'dark']) {
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
      ]) {
        const scenario = `${reducedMotion}-${colorScheme}-${viewport.width}`;
        const context = await browser.newContext({
          viewport,
          colorScheme,
          reducedMotion,
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.setDefaultTimeout(15000);

        try {
          await page.goto(`${baseUrl}/#code`, {
            waitUntil: 'domcontentloaded',
          });
          const section = page.locator('#code');
          const picker = section.getByRole('group', { name: 'Code examples' });
          const control = (name) =>
            picker.getByRole('button', { name, exact: true });
          const code = section.locator('pre code');

          await picker.scrollIntoViewIfNeeded();
          await expect(picker).toBeVisible();
          await ensurePickerPainted(picker);
          await expect(picker.getByRole('button')).toHaveCount(4);
          await expect(
            page.locator('[data-vellira-theme]').first()
          ).toHaveAttribute('data-vellira-theme', colorScheme);

          async function checkSelection(name, docsPlatform = 'react') {
            await expect(control(name)).toHaveAttribute('aria-pressed', 'true');
            await expect(picker.locator('[aria-pressed="true"]')).toHaveCount(
              1
            );
            for (const other of examples.filter((item) => item !== name)) {
              await expect(control(other)).toHaveAttribute(
                'aria-pressed',
                'false'
              );
            }
            await expect(
              section.getByText(`${name}.tsx`, { exact: true })
            ).toBeVisible();
            await expect(code).toHaveCount(1);
            await expect(code).toContainText(`<${name}`);
            await expect(
              section.getByRole('link', { name: 'Docs', exact: true })
            ).toHaveAttribute(
              'href',
              `https://docs.vellira.dev/${docsPlatform}/${name.toLowerCase()}`
            );
            const category = ['Button', 'Input'].includes(name)
              ? 'primitives'
              : 'components';
            await expect(
              section.getByRole('link', { name: 'Storybook', exact: true })
            ).toHaveAttribute(
              'href',
              `https://storybook.vellira.dev/?path=/docs/${category}-${name.toLowerCase()}--docs`
            );
          }

          // Start with a real state transition; visibility alone does not prove hydration.
          for (const name of ['Input', 'Modal', 'Dropdown', 'Button']) {
            await control(name).click();
            await checkSelection(name);
            await page.mouse.move(0, 0);
            for (const label of examples) {
              await expect(control(label)).toHaveAttribute('type', 'button');
              await checkGeometry(control(label));
            }
            const inactive = control(examples.find((label) => label !== name));
            await expect(inactive).toHaveCSS(
              'background-color',
              'rgba(0, 0, 0, 0)'
            );
            await expect(control(name)).not.toHaveCSS(
              'background-color',
              'rgba(0, 0, 0, 0)'
            );

            if (name === 'Input') {
              const input = section.getByRole('textbox', {
                name: 'Workspace name',
                exact: true,
              });
              await input.fill('Preserved workspace');
              await expect(input).toHaveValue('Preserved workspace');
            } else if (name === 'Modal') {
              await section
                .getByRole('button', { name: 'Open modal', exact: true })
                .click();
              const dialog = page.getByRole('dialog', {
                name: 'Create workspace',
              });
              await expect(dialog).toBeVisible();
              await dialog
                .getByRole('button', { name: 'Cancel', exact: true })
                .click();
              await expect(dialog).not.toBeVisible();
            } else if (name === 'Dropdown') {
              await section
                .getByRole('button', { name: 'Actions', exact: true })
                .click();
              const item = page.getByRole('menuitem', {
                name: 'Edit workspace',
                exact: true,
              });
              await expect(item).toBeVisible();
              await page.keyboard.press('Escape');
              await expect(item).not.toBeVisible();
            } else {
              await expect(
                section.getByRole('button', { name: 'Continue', exact: true })
              ).toBeVisible();
            }

            await ensurePickerPainted(picker);
            await picker.screenshot({
              path: `${artifactDir}/${scenario}-${name.toLowerCase()}.png`,
            });
          }

          async function expectVisibleKeyboardFocus(target) {
            await expect(target).toBeFocused();
            const focus = await target.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                visible: element.matches(':focus-visible'),
                outline: style.outlineStyle,
                width: style.outlineWidth,
              };
            });
            assert.ok(
              focus.visible &&
                focus.outline !== 'none' &&
                parseFloat(focus.width) > 0,
              'keyboard navigation must expose a visible focus indicator'
            );
          }

          await control('Button').focus();
          await control('Button').press('Tab');
          await expectVisibleKeyboardFocus(control('Input'));
          await control('Input').press('Enter');
          await expect(control('Input')).toBeFocused();
          await checkSelection('Input');
          await expect(
            section.getByRole('textbox', {
              name: 'Workspace name',
              exact: true,
            })
          ).toHaveValue('Preserved workspace');
          await control('Input').press('Tab');
          await expectVisibleKeyboardFocus(control('Modal'));
          await control('Modal').press('Space');
          await expect(control('Modal')).toBeFocused();
          await checkSelection('Modal');

          // This changes the displayed package/example, not the runtime of the web preview.
          await section
            .getByRole('tab', { name: 'React Native', exact: true })
            .click();
          await expect(code).toContainText("from '@vellira-ui/react-native';");
          await expect(
            section.getByText(
              'pnpm add @vellira-ui/react-native @react-native-picker/picker react-native-svg',
              {
                exact: true,
              }
            )
          ).toBeVisible();
          await control('Dropdown').click();
          await checkSelection('Dropdown', 'react-native');
          await expect(code).toContainText("from '@vellira-ui/react-native';");
          await section
            .getByRole('tab', { name: 'React', exact: true })
            .click();
          await expect(code).toContainText("from '@vellira-ui/react';");
          await checkSelection('Dropdown');

          // Use a clean page for visual evidence. A previously opened
          // CodeShowcase menu must not be mistaken for homepage layout.
          await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
          await expect(page.getByRole('menu')).toHaveCount(0);
          await expect(
            page.locator('[data-vellira-theme]').first()
          ).toHaveAttribute('data-vellira-theme', colorScheme);

          // Exercise the real Core dashboard in the existing website browser
          // session. This is not a screenshot mockup or a separate marketing
          // route; only one desktop scenario performs the complete interaction
          // sequence to avoid multiplying CI runtime across theme variants.
          if (
            reducedMotion === 'reduce' &&
            colorScheme === 'light' &&
            viewport.width === 1440
          ) {
            const demoSection = page.locator('#interface');
            const dashboard = page.locator('#dashboard-live');
            await dashboard.scrollIntoViewIfNeeded();
            await expect(dashboard).toBeVisible();
            await expect(
              demoSection.getByRole('link', { name: 'View Source' })
            ).toHaveAttribute(
              'href',
              'https://github.com/vellira-dev/vellira/blob/growth/react-native-form-try-it-20261018/examples/workspace-starter/web/src/Dashboard.tsx'
            );

            await dashboard
              .getByRole('button', { name: 'Projects', exact: true })
              .click();
            await dashboard
              .getByRole('button', { name: 'New project' })
              .click();

            const dialog = page.getByRole('dialog', {
              name: 'Create a project',
            });
            await expect(dialog).toBeVisible();
            await dialog
              .getByRole('textbox', { name: 'Project name' })
              .fill('Browser smoke project');

            await dialog.getByRole('combobox', { name: 'Team' }).click();
            const mobileOption = page.getByRole('option', {
              name: 'Mobile',
              exact: true,
            });
            await expect(mobileOption).toBeVisible();
            await mobileOption.click();
            await expect(dialog).toBeVisible();

            await dialog.getByRole('combobox', { name: 'Status' }).click();
            await page.getByRole('option', { name: 'Shipped' }).click();
            await dialog
              .getByRole('button', { name: 'Create project' })
              .click();
            await expect(dialog).toBeHidden();
            await expect(
              dashboard.getByText('Browser smoke project')
            ).toBeVisible();

            await dashboard
              .getByRole('button', { name: 'Settings', exact: true })
              .click();
            await dashboard
              .getByRole('textbox', { name: 'Workspace name' })
              .fill('Demo QA Workspace');
            await dashboard
              .getByRole('button', { name: 'Overview', exact: true })
              .click();
            await expect(
              dashboard.getByRole('heading', { name: 'Demo QA Workspace' })
            ).toBeVisible();

            const savedProjects = await page.evaluate(() => {
              const state = localStorage.getItem(
                'vellira-dashboard-live-core-v1'
              );
              return state ? JSON.parse(state).projects.length : null;
            });
            assert.equal(savedProjects, 4);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(
              dashboard.getByRole('heading', { name: 'Demo QA Workspace' })
            ).toBeVisible();
            await dashboard
              .getByRole('button', { name: 'Projects', exact: true })
              .click();
            await expect(
              dashboard.getByText('Browser smoke project')
            ).toBeVisible();
            await dashboard
              .getByRole('button', { name: 'Overview', exact: true })
              .click();
            await dashboard.scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `${artifactDir}/dashboard-core-live-1440.png`,
            });
          }

          if (
            reducedMotion === 'reduce' &&
            colorScheme === 'light' &&
            viewport.width === 390
          ) {
            const mobileDemo = page.locator('#dashboard-live');
            await mobileDemo.scrollIntoViewIfNeeded();
            await expect(mobileDemo).toBeVisible();
            const rect = await mobileDemo.boundingBox();
            assert.ok(
              rect && rect.x >= -1 && rect.x + rect.width <= viewport.width + 1,
              'Core dashboard must fit mobile viewport without overflow'
            );
            await mobileDemo
              .getByRole('button', { name: 'Projects', exact: true })
              .click();
            await expect(
              mobileDemo.getByRole('textbox', { name: 'Search projects' })
            ).toBeVisible();
            await page.screenshot({
              path: `${artifactDir}/dashboard-core-live-390.png`,
            });
          }

          // Review the new homepage narrative in each theme, viewport and
          // motion preference, using the same real browser as CodeShowcase.
          const story = page.locator('#why-vellira');
          await story.scrollIntoViewIfNeeded();
          await expect(story).toBeVisible();
          await expect(
            story.getByRole('heading', {
              name: /AI can generate more UI/,
              level: 2,
            })
          ).toBeVisible();

          const storyCards = story.getByRole('article');
          await expect(storyCards).toHaveCount(3);
          const storyBounds = await storyCards.evaluateAll((elements) =>
            elements.map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                left: rect.left,
                right: rect.right,
                top: rect.top,
              };
            })
          );

          for (const bounds of storyBounds) {
            assert.ok(
              bounds.left >= -1 && bounds.right <= viewport.width + 1,
              `Consistency card must fit ${viewport.width}px viewport: ${JSON.stringify(bounds)}`
            );
          }
          if (viewport.width <= 920) {
            assert.ok(
              storyBounds[0].top < storyBounds[1].top &&
                storyBounds[1].top < storyBounds[2].top,
              'Mobile consistency cards must stack in reading order'
            );
          } else {
            assert.ok(
              Math.abs(storyBounds[0].top - storyBounds[2].top) < 4,
              'Desktop consistency cards must align on one row'
            );
          }

          const firstStoryCard = storyCards.first();
          await firstStoryCard.hover();
          if (reducedMotion === 'reduce') {
            await expect(firstStoryCard).toHaveCSS('transform', 'none');
          } else {
            await expect
              .poll(() =>
                firstStoryCard.evaluate(
                  (element) => getComputedStyle(element).transform
                )
              )
              .not.toBe('none');
          }
          await page.mouse.move(0, 0);
          await expect(firstStoryCard).toHaveCSS('transform', 'none');
          // Viewport screenshots represent what a visitor can really see:
          // a tall element screenshot can stitch sticky headers and portals.
          const storyHeading = story.getByRole('heading', { level: 2 });
          await storyHeading.scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollBy(0, -120));
          await page.screenshot({
            path: `${artifactDir}/${scenario}-story-top.png`,
          });
          await storyCards.last().scrollIntoViewIfNeeded();
          await page.screenshot({
            path: `${artifactDir}/${scenario}-story-bottom.png`,
          });

          const quickStart = page.locator('#quick-start');
          await quickStart.scrollIntoViewIfNeeded();
          const quickImport = quickStart.locator('pre code').nth(1);
          await quickImport.scrollIntoViewIfNeeded();
          await expect(quickImport).toHaveCSS('white-space', 'pre');
          await expect(quickImport).toContainText(
            "import '@vellira-ui/react/styles';"
          );
          await expect(quickImport).toContainText(
            "import { Button } from '@vellira-ui/react';"
          );
          // The existing motion reveal includes opacity and blur. Screenshot
          // only after the code and all ancestor reveal layers have painted.
          await expect
            .poll(() =>
              quickImport.evaluate((element) => {
                for (let node = element; node; node = node.parentElement) {
                  const style = getComputedStyle(node);
                  if (Number(style.opacity) < 0.99) return false;
                  const blur = style.filter.match(/blur\(([^)]+)\)/);
                  if (blur && Number(blur[1]) > 0.1) return false;
                }
                return true;
              })
            )
            .toBe(true);
          await quickStart.locator('pre').nth(1).screenshot({
            path: `${artifactDir}/${scenario}-quick-start-import.png`,
          });

          assert.deepEqual(pageErrors, [], 'unexpected page errors');
          evidence.push({
            scenario,
            examples,
            keyboard: 'passed',
            platformSwitch: 'passed',
            pageErrors,
          });
          console.log(`CodeShowcase browser regression: ${scenario} OK`);
        } catch (error) {
          await page
            .screenshot({
              path: `${artifactDir}/${scenario}-failure.png`,
              fullPage: true,
            })
            .catch(() => {});
          throw error;
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await writeFile(
    `${artifactDir}/report.json`,
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  await browser.close();
}
