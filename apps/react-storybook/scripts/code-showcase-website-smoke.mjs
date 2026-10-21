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
  await expect
    .poll(
      () =>
        picker.evaluate((element) => {
          // React hydration can reposition the picker after a one-shot scroll.
          // On every poll, scroll the current DOM node and recheck real paint.
          element.scrollIntoView({
            behavior: 'instant',
            block: 'center',
            inline: 'center',
          });
          const rect = element.getBoundingClientRect();
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            rect.top < -1 ||
            rect.left < -1 ||
            rect.bottom > window.innerHeight + 1 ||
            rect.right > window.innerWidth + 1
          ) {
            return false;
          }
          for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (
              Number(style.opacity) < 1 ||
              style.visibility !== 'visible' ||
              style.display === 'none'
            ) {
              return false;
            }
          }
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          );
          return hit !== null && (hit === element || element.contains(hit));
        }),
      {
        message: 'Picker must be in viewport, fully painted and unobscured',
        timeout: 20000,
      }
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

          await expect(picker).toBeVisible();
          // ensurePickerPainted already scrolls, checks viewport and verifies
          // real hit-testing. Avoid a redundant actionability wait during hydration.
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
            await expect(dashboard).toBeVisible();
            await page.evaluate(() => {
              document.getElementById('dashboard-live')?.scrollIntoView({
                behavior: 'instant',
                block: 'start',
              });
            });
            await expect(dashboard).toBeInViewport();
            await expect(dashboard).toBeVisible();
            // Button icons belong in the supported iconStart slot, not
            // as SVG children inside the label. Assert real painted geometry.
            const navButton = dashboard.getByRole('button', {
              name: 'Dashboard',
              exact: true,
            });
            const addButton = dashboard.getByRole('button', {
              name: 'New project',
            });
            for (const [button, label] of [
              [navButton, 'Dashboard'],
              [addButton, 'New project'],
            ]) {
              const icon = await button.locator('svg').boundingBox();
              const word = await button.getByText(label, { exact: true }).boundingBox();
              assert.ok(icon && word, label + ' needs visible icon and text');
              assert.ok(
                Math.abs(
                  icon.y + icon.height / 2 - (word.y + word.height / 2)
                ) < 8,
                label + ' icon and text must share one horizontal row'
              );
            }
            const toolbarSearch = dashboard.getByRole('searchbox', {
              name: 'Search projects',
            });
            await expect(toolbarSearch).toBeVisible();
            await expect(
              dashboard.getByText('Search projects', { exact: true })
            ).toHaveCount(0);
            const searchBounds = await toolbarSearch.boundingBox();
            assert.ok(
              searchBounds && searchBounds.height <= 52,
              'Toolbar search must use one compact row, without field caption'
            );

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
            // The settings panel must occupy the available main area, not
            // leave a large unpainted gap above the dashboard footer.
            const settingsPanel = dashboard.locator('main > section').last();
            await expect(settingsPanel).toBeVisible();
            const settingsBox = await settingsPanel.boundingBox();
            assert.ok(
              settingsBox && settingsBox.width > 0 && settingsBox.height > 0,
              'Settings panel must have visible dimensions'
            );
            // Compare the Core md field geometries without hard-coded pixel values.
            const workspaceField = dashboard.getByRole('textbox', { name: 'Workspace name' });
            const themeSelect = dashboard.getByRole('combobox', { name: 'Theme' });
            const resetButton = dashboard.getByRole('button', { name: 'Restore sample data' });
            const controlHeights = await Promise.all(
              [workspaceField, themeSelect, resetButton].map(async (locator) => {
                const rect = await locator.boundingBox();
                assert.ok(rect, 'Settings control must be rendered');
                return rect.height;
              })
            );
            assert.ok(
              Math.max(...controlHeights) - Math.min(...controlHeights) <= 2,
              `Core md controls differ: Input=${controlHeights[0]}, Select=${controlHeights[1]}, Button=${controlHeights[2]}`
            );
            await dashboard
              .getByRole('textbox', { name: 'Workspace name' })
              .fill('Demo QA Workspace');
            await dashboard
              .getByRole('button', { name: 'Dashboard', exact: true })
              .click();
            await expect(
              dashboard.getByText('Demo QA Workspace', { exact: true })
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
              dashboard.getByText('Demo QA Workspace', { exact: true })
            ).toBeVisible();
            await dashboard
              .getByRole('button', { name: 'Projects', exact: true })
              .click();
            await expect(
              dashboard.getByText('Browser smoke project')
            ).toBeVisible();
            await dashboard
              .getByRole('button', { name: 'Dashboard', exact: true })
              .click();
            await expect(dashboard).toBeVisible();
            await page.evaluate(() => {
              document.getElementById('dashboard-live')?.scrollIntoView({
                behavior: 'instant',
                block: 'start',
              });
            });
            await expect(dashboard).toBeInViewport();
            await page.screenshot({
              path: `${artifactDir}/dashboard-core-live-1440.png`,
            });
            // Search must show filtered results, and the workspace data must
            // remain available after a browser reload.
            await dashboard.getByRole('searchbox', { name: 'Search projects' }).fill('Browser smoke project');
            await expect(dashboard.getByText('Browser smoke project')).toBeVisible();
            await expect(dashboard.getByText('1 matching projects')).toBeVisible();
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(dashboard.getByRole('heading', { name: 'Projects', exact: true, level: 3 })).toBeVisible();
            await dashboard.getByRole('button', { name: 'Projects', exact: true }).click();
            await expect(dashboard.getByText('Browser smoke project')).toBeVisible();
            // A selected Projects status must survive reload just like the view.
            await dashboard.getByRole('combobox', { name: 'Status filter' }).click();
            await page.getByRole('option', { name: 'Shipped', exact: true }).click();
            await expect(dashboard.getByRole('combobox', { name: 'Status filter' })).toContainText('Shipped');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await expect(dashboard.getByRole('heading', { name: 'Projects', exact: true, level: 3 })).toBeVisible();
            await expect(dashboard.getByRole('combobox', { name: 'Status filter' })).toContainText('Shipped');
            await dashboard.getByRole('button', { name: 'Settings', exact: true }).click();
            await dashboard.getByRole('button', { name: 'Restore sample data' }).click();
            const resetDialog = page.getByRole('dialog', { name: 'Restore sample data?' });
            await expect(resetDialog).toBeVisible();
            await resetDialog.getByRole('button', { name: 'Cancel' }).click();
            await expect(resetDialog).toBeHidden();
            await dashboard.getByRole('button', { name: 'Restore sample data' }).click();
            await resetDialog.getByRole('button', { name: 'Restore data' }).click();
            await expect(dashboard.getByText('Demo projects restored.')).toBeVisible();

          }

          if (
            reducedMotion === 'reduce' &&
            colorScheme === 'light' &&
            viewport.width === 390
          ) {
            const mobileDemo = page.locator('#dashboard-live');
            await expect(mobileDemo).toBeVisible();
            await page.evaluate(() => {
              document.getElementById('dashboard-live')?.scrollIntoView({
                behavior: 'instant',
                block: 'start',
              });
            });
            await expect(mobileDemo).toBeInViewport();
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
              mobileDemo.getByRole('searchbox', { name: 'Search projects' })
            ).toBeVisible();
            await page.screenshot({
              path: `${artifactDir}/dashboard-core-live-390.png`,
            });
          }

          // Theme and responsive smoke for the real Dashboard in every
          // browser matrix scenario, not only the interactive light desktop case.
          const themedDashboard = page.locator('#dashboard-live');
          await expect(themedDashboard).toBeVisible();
          await expect(
            themedDashboard.locator('[class*="brandMark"] img')
          ).toHaveCount(2);
          const themedBounds = await themedDashboard.boundingBox();
          assert.ok(themedBounds && themedBounds.width <= viewport.width + 1,
            'Dashboard must fit all supported viewport/theme combinations');
          const dashboardNav = themedDashboard.getByRole('button', {
            name: 'Settings', exact: true,
          });
          await dashboardNav.focus();
          await expect(dashboardNav).toBeFocused();
          await page.keyboard.press('Enter');
          await expect(themedDashboard.getByRole('heading', { name: 'Settings', exact: true, level: 3 })).toBeVisible();
          await themedDashboard.getByRole('button', { name: 'Dashboard', exact: true }).click();

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
