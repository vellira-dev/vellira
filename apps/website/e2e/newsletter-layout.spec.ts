import { expect, test } from '@playwright/test';

test('newsletter controls stay fixed when validation appears', async ({
  page,
}) => {
  await page.goto('/blog');

  const email = page.locator('input[name="email"]');
  const subscribe = page.getByRole('button', { name: 'Subscribe' });
  const info = page.getByRole('button', {
    name: 'Newsletter email privacy information',
  });

  await expect(email).toBeVisible();
  await expect(subscribe).toBeVisible();
  await expect(info).toBeEnabled();
  await email.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);

  const before = await page.evaluate(() => ({
    email: document
      .querySelector<HTMLInputElement>('input[name="email"]')
      ?.getBoundingClientRect().top,
    subscribe: Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Subscribe')
      ?.getBoundingClientRect().top,
  }));

  await subscribe.click();
  await expect(page.getByText('Enter your email address.')).toBeVisible();

  const after = await page.evaluate(() => ({
    email: document
      .querySelector<HTMLInputElement>('input[name="email"]')
      ?.getBoundingClientRect().top,
    subscribe: Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Subscribe')
      ?.getBoundingClientRect().top,
  }));

  expect(
    Math.abs((after.email ?? 0) - (before.email ?? 0))
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs((after.subscribe ?? 0) - (before.subscribe ?? 0))
  ).toBeLessThanOrEqual(1);

  await info.hover();
  await expect(page.getByRole('tooltip')).toContainText(
    'We’ll only send Vellira engineering notes. Unsubscribe anytime.'
  );

  await info.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
});
