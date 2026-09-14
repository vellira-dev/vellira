import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const storyUrl = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

async function openStory(page: Page, id: string) {
  await page.goto(storyUrl(id));
  await expect(page.locator('#storybook-root')).toBeVisible();
}

async function pressSequentialFocus(page: Page, browserName: string) {
  const key =
    browserName === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab';

  await page.keyboard.press(key);
}

async function expectPortaled(page: Page, selector: string) {
  await expect(page.locator(`#storybook-root ${selector}`)).toHaveCount(0);
  await expect(
    page.locator(`body > ${selector}, body ${selector}`)
  ).toBeVisible();
}

async function expectFloatingNearReference(
  reference: Locator,
  floating: Locator
) {
  const referenceBox = await reference.boundingBox();
  const floatingBox = await floating.boundingBox();

  expect(referenceBox).not.toBeNull();
  expect(floatingBox).not.toBeNull();

  expect(floatingBox!.width).toBeGreaterThan(0);
  expect(floatingBox!.height).toBeGreaterThan(0);
  expect(floatingBox!.y).toBeGreaterThanOrEqual(referenceBox!.y - 8);
  expect(floatingBox!.x + floatingBox!.width).toBeGreaterThan(referenceBox!.x);
  expect(floatingBox!.x).toBeLessThan(referenceBox!.x + referenceBox!.width);
}

test.describe('cross-browser interaction launch contracts @cross-browser', () => {
  test.describe.configure({ retries: 0 });

  test('Dropdown supports keyboard navigation, focus restore, portal, outside click, and positioning', async ({
    page,
  }) => {
    await openStory(page, 'components-dropdown--default');

    const trigger = page.getByRole('button', { name: 'Actions' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    const menu = page.getByRole('menu', { name: 'Actions' });
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeFocused();
    await expectPortaled(page, '[role="menu"]');
    await expectFloatingNearReference(trigger, menu);

    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveAttribute('aria-activedescendant', /item-1$/);

    await page.locator('#storybook-root').click({ position: { x: 1, y: 1 } });
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Select keeps focus on the trigger, handles keyboard dismissal, portals content, and uses its mobile sheet', async ({
    isMobile,
    page,
  }) => {
    await openStory(page, 'components-select--simple-usage');

    const trigger = page.getByRole('combobox');
    await expect(trigger).toHaveAccessibleName('Country');

    if (isMobile) {
      await trigger.tap();
    } else {
      await trigger.focus();
      await trigger.press('Enter');
    }

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    if (!isMobile) {
      await expect(trigger).toBeFocused();
    }

    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const triggerId = await trigger.getAttribute('id');

    expect(triggerId).not.toBeNull();

    await expect(listbox).toHaveAttribute('aria-labelledby', triggerId!);
    await expectPortaled(page, '[role="listbox"]');

    const triggerBox = await trigger.boundingBox();
    const listboxBox = await listbox.boundingBox();
    const dropdown = listbox.locator('xpath=..');

    expect(triggerBox).not.toBeNull();
    expect(listboxBox).not.toBeNull();

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const isMobileSheet = isMobile && viewportSize!.width < 640;

    if (!isMobileSheet) {
      await expect
        .poll(
          async () => {
            const currentTriggerBox = await trigger.boundingBox();
            const currentDropdownBox = await dropdown.boundingBox();

            if (!currentTriggerBox || !currentDropdownBox) {
              return Number.POSITIVE_INFINITY;
            }

            return Math.abs(currentDropdownBox.width - currentTriggerBox.width);
          },
          {
            message: 'Select dropdown should match the trigger width',
          }
        )
        .toBeLessThanOrEqual(1);

      await expectFloatingNearReference(trigger, dropdown);
    } else {
      const dropdownBox = await dropdown.boundingBox();

      expect(dropdownBox).not.toBeNull();
      expect(dropdownBox!.x).toBeGreaterThanOrEqual(0);
      expect(dropdownBox!.x + dropdownBox!.width).toBeLessThanOrEqual(
        viewportSize!.width
      );
      expect(dropdownBox!.width).toBeGreaterThanOrEqual(triggerBox!.width);
    }

    if (isMobile) {
      await page.getByRole('option', { name: 'France', exact: true }).tap();
      await expect(listbox).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toHaveAccessibleName('France');
      return;
    }

    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /option-1$/);

    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
  });

  test('Tooltip opens from focus, closes on tab movement, renders through a portal, and stays within the viewport', async ({
    browserName,
    page,
  }) => {
    await openStory(page, 'components-tooltip--no-delay');

    const trigger = page.getByRole('button', { name: 'Instant Tooltip' });
    await trigger.focus();

    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    const tooltipId = await tooltip.getAttribute('id');

    expect(tooltipId).not.toBeNull();

    await expect(trigger).toHaveAttribute('aria-describedby', tooltipId!);
    await expectPortaled(page, '[role="tooltip"]');

    const box = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

    await pressSequentialFocus(page, browserName);
    await expect(
      page.getByRole('button', { name: 'Next focus target' })
    ).toBeFocused();
    await expect(tooltip).toBeHidden();
    await expect(trigger).not.toHaveAttribute('aria-describedby', tooltipId!);
  });

  test('Modal renders in a portal, traps focus, and closes with Escape', async ({
    browserName,
    page,
  }) => {
    await openStory(page, 'components-modal--default');

    const opener = page.getByRole('button', { name: 'Open modal' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
    await expect(dialog).toBeVisible();
    await expectPortaled(page, '[role="dialog"]');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    const closeButton = dialog.getByRole('button', { name: 'Close dialog' });
    const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
    const saveButton = dialog.getByRole('button', { name: 'Save changes' });

    await expect(closeButton).toBeFocused();

    await pressSequentialFocus(page, browserName);
    await expect(cancelButton).toBeFocused();

    await pressSequentialFocus(page, browserName);
    await expect(saveButton).toBeFocused();

    await pressSequentialFocus(page, browserName);
    await expect(closeButton).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test.describe('desktop-only contracts', () => {
    test.skip(
      ({ isMobile }) => isMobile,
      'The focused mobile contract is covered by the Select sheet scenario.'
    );

    test('Popover preserves controlled open state across portal, outside press, and Escape transitions', async ({
      page,
    }) => {
      await openStory(page, 'components-popover--controlled');

      const trigger = page.getByRole('button');
      const dialog = page.getByRole('dialog', {
        name: 'Controlled popover',
      });

      await expect(trigger).toHaveAccessibleName('Popover open');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(dialog).toBeVisible();
      await expectPortaled(page, '[role="dialog"]');

      await page.locator('#storybook-root').click({ position: { x: 1, y: 1 } });
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveAccessibleName('Popover closed');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await trigger.click();
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAccessibleName('Popover open');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveAccessibleName('Popover closed');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
    });

    test('Tabs uses native tab order and keyboard focus movement to update controlled content', async ({
      page,
    }) => {
      await openStory(page, 'components-tabs--controlled');

      const home = page.getByRole('tab', { name: 'Home' });
      const profile = page.getByRole('tab', { name: 'Profile' });
      const currentValue = page.locator('p').filter({
        hasText: 'Current value:',
      });

      await expect(home).toHaveAttribute('aria-selected', 'true');
      await expect(home).toHaveAttribute('tabindex', '0');
      await expect(profile).toHaveAttribute('tabindex', '-1');

      await page.keyboard.press('Tab');
      await expect(home).toBeFocused();

      await page.keyboard.press('ArrowRight');
      await expect(profile).toBeFocused();
      await expect(profile).toHaveAttribute('aria-selected', 'true');
      await expect(profile).toHaveAttribute('tabindex', '0');
      await expect(home).toHaveAttribute('tabindex', '-1');
      await expect(currentValue).toContainText('profile');

      const profilePanel = page.getByRole('tabpanel', { name: 'Profile' });
      await expect(profilePanel).toBeVisible();
      await expect(profilePanel).toContainText('Profile content');

      await page.keyboard.press('Tab');
      await expect(profilePanel).toBeFocused();
    });
  });
});
