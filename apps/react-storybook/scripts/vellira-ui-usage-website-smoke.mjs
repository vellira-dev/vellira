import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL ?? 'http://127.0.0.1:3101';
const artifactDir = 'test-results/vellira-ui-usage';
const browser = await chromium.launch({ headless: true });
const evidence = [];

await mkdir(artifactDir, { recursive: true });

try {
  for (const theme of ['light', 'dark', 'high-contrast']) {
    for (const width of [1440, 390]) {
      const scenario = `${theme}-${width}`;
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
      });
      await context.addInitScript((preference) => {
        globalThis.localStorage.setItem('vellira-website-theme', preference);
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.setDefaultTimeout(15000);

      try {
        await page.goto(`${baseUrl}/components`);
        await expect(page.locator('html')).toHaveAttribute(
          'data-vellira-theme',
          theme
        );
        const catalogSearch = page.getByRole('searchbox', {
          name: 'Search components',
        });
        await expect(catalogSearch).toBeVisible();
        await expect(catalogSearch).toHaveCSS('font-size', '14px');
        await expect(catalogSearch).toHaveCSS('padding-left', '0px');
        await catalogSearch.fill('does-not-exist');
        await expect(
          page.getByText('No components found', { exact: true })
        ).toBeVisible();
        await page
          .getByRole('button', { name: 'Clear search', exact: true })
          .click();
        await expect(catalogSearch).toHaveValue('');
        await catalogSearch.fill('button');
        await expect(
          page.getByRole('heading', { name: 'Button', exact: true })
        ).toBeVisible();
        const nativeFilter = page.getByRole('button', {
          name: 'React Native',
          exact: true,
        });
        await nativeFilter.click();
        await expect(nativeFilter).toHaveAttribute('aria-pressed', 'true');
        await expect(catalogSearch).toHaveValue('button');
        await page.screenshot({
          path: `${artifactDir}/${scenario}-catalog.png`,
        });

        const header = page.locator('header');
        if (width === 390) {
          await header.getByRole('button', { name: 'Open search' }).click();
        }
        const headerSearch = header.getByRole('combobox', {
          name: 'Search components',
        });
        await headerSearch.fill('button');
        await expect(page.getByRole('listbox')).toBeVisible();
        await header
          .getByRole('button', {
            name: width === 390 ? 'Close search' : 'Clear search',
            exact: true,
          })
          .click();
        if (width === 390) {
          await expect(headerSearch).toBeHidden();
          await header.getByRole('button', { name: 'Open search' }).click();
        }
        await expect(headerSearch).toHaveValue('');
        await expect(headerSearch).toBeFocused();
        await headerSearch.fill('button');
        await headerSearch.press('ArrowDown');
        const selectedId = await headerSearch.getAttribute(
          'aria-activedescendant'
        );
        assert.ok(selectedId);
        await expect(
          page.getByRole('option', { selected: true }).first()
        ).toHaveAttribute('id', selectedId);
        await page.screenshot({
          path: `${artifactDir}/${scenario}-header-search.png`,
        });
        await headerSearch.press('Enter');
        await expect(page).toHaveURL(/\/components\/button$/);

        await page.goto(`${baseUrl}/components/input`);
        const platform = page.getByRole('group', {
          name: 'Platform',
          exact: true,
        });
        const nativePlatform = platform.getByRole('button', {
          name: 'React Native',
          exact: true,
        });
        await expect(nativePlatform).toHaveCSS('min-height', '30px');
        await expect(nativePlatform).toHaveCSS('padding-left', '12px');
        await nativePlatform.click();
        await expect(nativePlatform).toHaveAttribute('aria-pressed', 'true');
        await platform
          .getByRole('button', { name: 'React', exact: true })
          .click();
        await expect(nativePlatform).toHaveAttribute('aria-pressed', 'false');

        const labelControl = page.getByRole('textbox', {
          name: 'Label',
          exact: true,
        });
        await labelControl.scrollIntoViewIfNeeded();
        await expect(labelControl).toHaveCSS('min-height', '40px');
        await expect(labelControl).toHaveCSS('padding-left', '12px');
        await expect(labelControl).toHaveCSS('border-top-width', '1px');
        await labelControl.fill('Updated input label');
        await expect(
          page.getByRole('textbox', {
            name: 'Updated input label',
            exact: true,
          })
        ).toBeVisible();
        await labelControl.focus();
        await expect(labelControl).toHaveCSS('transform', 'none');
        assert.notEqual(
          await labelControl.evaluate(
            (element) =>
              element.ownerDocument.defaultView.getComputedStyle(element)
                .boxShadow
          ),
          'none'
        );
        const disabledToggle = page.getByRole('button', {
          name: 'Disabled',
          exact: true,
        });
        await expect(disabledToggle).toHaveCSS('min-height', '36px');
        await disabledToggle.click();
        await expect(disabledToggle).toHaveAttribute('aria-pressed', 'true');
        await expect(
          page.getByRole('textbox', {
            name: 'Updated input label',
            exact: true,
          })
        ).toBeDisabled();
        await disabledToggle.click();
        await expect(
          page.getByRole('textbox', {
            name: 'Updated input label',
            exact: true,
          })
        ).toBeEnabled();
        await page.screenshot({
          path: `${artifactDir}/${scenario}-playground.png`,
        });
        if (width === 390) {
          await page.goto(baseUrl);
          const menuTrigger = page.locator(
            'header button[aria-controls="mobile-site-navigation"]'
          );
          await menuTrigger.click();
          await expect(menuTrigger).toHaveAttribute('aria-expanded', 'true');
          const backdrop = page.locator(
            'button[class*="mobileNavigationBackdrop"]'
          );
          await expect(backdrop).toBeVisible();
          const bounds = await backdrop.boundingBox();
          assert.ok(bounds);
          await backdrop.click({ position: { x: 5, y: bounds.height - 5 } });
          await expect(menuTrigger).toHaveAttribute('aria-expanded', 'false');
        }
        assert.deepEqual(errors, []);
        evidence.push({ scenario, passed: true });
        console.log(`OK Vellira consumer controls: ${scenario}`);
      } catch (error) {
        await page.screenshot({
          path: `${artifactDir}/${scenario}-failure.png`,
        });
        throw error;
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await writeFile(
    `${artifactDir}/evidence.json`,
    JSON.stringify(evidence, null, 2)
  );
  await browser.close();
}
