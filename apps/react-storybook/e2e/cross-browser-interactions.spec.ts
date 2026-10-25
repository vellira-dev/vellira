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

  test('Dropdown submenu supports APG keyboard focus, Escape, and activation', async ({
    page,
  }) => {
    await openStory(page, 'components-dropdown--submenus');

    const trigger = page.getByRole('button', { name: 'Actions' });
    const menu = page.getByRole('menu', { name: 'Actions' });
    await expect(menu).toBeVisible();
    await menu.focus();

    await page.keyboard.press('ArrowDown');
    const exportTrigger = menu.getByRole('menuitem', {
      name: 'Export',
      exact: true,
    });
    await expect(menu).toHaveAttribute(
      'aria-activedescendant',
      (await exportTrigger.getAttribute('id'))!
    );

    await page.keyboard.press('ArrowRight');
    const subMenu = page.getByRole('menu', { name: 'Export' });
    const pdf = subMenu.getByRole('menuitem', { name: 'Export as PDF' });
    const archive = subMenu.getByRole('menuitem', {
      name: 'Download archive',
    });
    await expect(subMenu).toBeVisible();
    await expect(menu).toHaveAttribute(
      'aria-activedescendant',
      (await pdf.getAttribute('id'))!
    );
    await expect(menu).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await expect(menu).toHaveAttribute(
      'aria-activedescendant',
      (await archive.getAttribute('id'))!
    );
    await page.keyboard.press('Escape');
    await expect(subMenu).toBeHidden();
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute(
      'aria-activedescendant',
      (await exportTrigger.getAttribute('id'))!
    );

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('Dropdown submenu is painted, anchored and pointer-selectable', async ({
    isMobile,
    page,
  }) => {
    await openStory(page, 'components-dropdown--submenus');

    const root = page.getByRole('menu', { name: 'Actions' });
    const exportTrigger = root.getByRole('menuitem', {
      name: 'Export',
      exact: true,
    });
    const submenu = page.getByRole('menu', { name: 'Export' });
    const pdf = submenu.getByRole('menuitem', { name: 'Export as PDF' });

    if (isMobile) {
      await exportTrigger.tap();
    } else {
      await exportTrigger.hover();
    }

    await expect(submenu).toBeVisible();
    await expect(root).toHaveAttribute('data-submenu-open', 'true');
    await expect(exportTrigger).toHaveAttribute('aria-expanded', 'true');

    const parent = await exportTrigger.boundingBox();
    const flyout = await submenu.boundingBox();
    const arrow = await exportTrigger.locator('svg').last().boundingBox();
    expect(parent).not.toBeNull();
    expect(flyout).not.toBeNull();
    expect(arrow).not.toBeNull();

    // Catch a real clipped submenu: Playwright toBeVisible() alone is
    // insufficient when overflow hides all pixels outside the menu.
    const painted = await pdf.evaluate((item) => {
      const rect = item.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return (
        x >= 0 &&
        x <= window.innerWidth &&
        y >= 0 &&
        y <= window.innerHeight &&
        Boolean(hit && item.contains(hit))
      );
    });
    expect(painted).toBe(true);

    // The chevron must use optical geometric centering, not the SVG's
    // default inline-text baseline.
    const chevronCenter = arrow!.y + arrow!.height / 2;
    const itemCenter = parent!.y + parent!.height / 2;
    expect(Math.abs(chevronCenter - itemCenter)).toBeLessThanOrEqual(2);

    const viewport = page.viewportSize()!;
    if (isMobile) {
      expect(flyout!.x).toBeGreaterThanOrEqual(-1);
      expect(flyout!.x + flyout!.width).toBeLessThanOrEqual(
        viewport.width + 1
      );
      expect(flyout!.y).toBeGreaterThanOrEqual(parent!.y + parent!.height - 2);
    } else {
      expect(flyout!.x).toBeGreaterThanOrEqual(parent!.x + parent!.width - 2);
      expect(Math.abs(flyout!.y - parent!.y)).toBeLessThanOrEqual(4);
      expect(flyout!.x + flyout!.width).toBeLessThanOrEqual(
        viewport.width + 1
      );
    }

    if (isMobile) {
      await pdf.tap();
    } else {
      await pdf.click();
    }
    await expect(root).toBeHidden();
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

  test('nested Modal Select options are visible, clickable and dismiss independently', async ({
    page,
    isMobile,
  }) => {
    await openStory(page, 'components-modal--nested-select');

    const opener = page.getByRole('button', { name: 'Create project' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'Create project' });
    await expect(dialog).toBeVisible();

    const team = dialog.getByRole('combobox', { name: 'Team' });
    await expect(team).toHaveAttribute('aria-expanded', 'false');

    if (isMobile) {
      await team.tap();
    } else {
      await team.click();
    }

    const listbox = page.getByRole('listbox');
    const mobile = page.getByRole('option', { name: 'Mobile', exact: true });

    await expect(listbox).toBeVisible();
    await expect(mobile).toBeVisible();
    await expect(team).toHaveAttribute('aria-expanded', 'true');
    expect(
      await listbox.evaluate((node) => node.closest('[role="dialog"]'))
    ).toBeNull();

    await expect
      .poll(
        () =>
          mobile.evaluate((node) => {
            const bounds = node.getBoundingClientRect();
            const x = bounds.left + bounds.width / 2;
            const y = bounds.top + bounds.height / 2;
            const target = document.elementFromPoint(x, y);

            return (
              bounds.width > 0 &&
              bounds.height > 0 &&
              target !== null &&
              (target === node || node.contains(target))
            );
          }),
        { message: 'Nested Select option should win browser hit-testing' }
      )
      .toBe(true);

    if (isMobile) {
      await mobile.tap();
    } else {
      await mobile.click();
    }

    await expect(dialog.getByTestId('selected-team')).toHaveText(
      'Selected team: mobile'
    );
    await expect(listbox).toBeHidden();
    await expect(dialog).toBeVisible();

    // This test switches from a pointer-selected Team option to keyboard-only
    // Status navigation. Keep the cursor away from the next dropdown so its
    // stationary hover does not overwrite the keyboard's active option.
    await page.mouse.move(0, 0);

    const status = dialog.getByRole('combobox', { name: 'Status' });
    await status.focus();
    await status.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(status).toHaveAttribute('aria-expanded', 'false');

    await status.focus();
    await status.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(status).toBeFocused();
    await status.press('End');
    await expect(status).toHaveAttribute('aria-activedescendant', /-option-2$/);
    await status.press('Enter');

    await expect(dialog.getByTestId('selected-status')).toHaveText(
      'Selected status: shipped'
    );
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
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
