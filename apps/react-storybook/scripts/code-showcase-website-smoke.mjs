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

          async function checkSelection(name) {
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
              `https://docs.vellira.dev/components/${name.toLowerCase()}`
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

          await control('Button').focus();
          await control('Button').press('Tab');
          await expect(control('Input')).toBeFocused();
          await control('Input').press('Enter');
          await checkSelection('Input');
          await expect(
            section.getByRole('textbox', {
              name: 'Workspace name',
              exact: true,
            })
          ).toHaveValue('Preserved workspace');
          const focus = await control('Input').evaluate((element) => {
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
            'keyboard focus must remain visible'
          );
          await control('Input').press('Tab');
          await expect(control('Modal')).toBeFocused();
          await control('Modal').press('Space');
          await checkSelection('Modal');

          // This changes the displayed package/example, not the runtime of the web preview.
          await section
            .getByRole('tab', { name: 'React Native', exact: true })
            .click();
          await expect(code).toContainText("from '@vellira-ui/react-native';");
          await expect(
            section.getByText('pnpm add @vellira-ui/react-native', {
              exact: true,
            })
          ).toBeVisible();
          await control('Dropdown').click();
          await checkSelection('Dropdown');
          await expect(code).toContainText("from '@vellira-ui/react-native';");
          await section
            .getByRole('tab', { name: 'React', exact: true })
            .click();
          await expect(code).toContainText("from '@vellira-ui/react';");
          await checkSelection('Dropdown');

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
