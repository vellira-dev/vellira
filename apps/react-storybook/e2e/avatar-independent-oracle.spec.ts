import { createHash } from 'node:crypto';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// Read-only frozen CSS fixture from Avatar Draft #1523, at
// f5580adf16b6a23df3df1425b54920ca49a8c678.
// This is NOT a runtime test of a new Avatar implementation. Pin the Git blob
// so the negative control cannot silently become a hand-corrected candidate.
const historicAvatarStyles =
  [
    '.avatar {',
    '  display: inline-flex;',
    '  position: relative;',
    '  align-items: center;',
    '  justify-content: center;',
    '  flex: 0 0 auto;',
    '  overflow: hidden;',
    '  border: 1px solid var(--avatar-default-border);',
    '  border-radius: 50%;',
    '  background: var(--avatar-default-bg);',
    '  color: var(--avatar-default-fg);',
    '  font-family: inherit;',
    '  font-weight: 600;',
    '  line-height: 1;',
    '}',
    '',
    '.sm {',
    '  width: 24px;',
    '  height: 24px;',
    '  font-size: 0.75rem;',
    '}',
    '',
    '.md {',
    '  width: 32px;',
    '  height: 32px;',
    '  font-size: 0.875rem;',
    '}',
    '',
    '.lg {',
    '  width: 40px;',
    '  height: 40px;',
    '  font-size: 1rem;',
    '}',
    '',
    '.fallback {',
    '  user-select: none;',
    '}',
    '',
    '.image {',
    '  position: absolute;',
    '  inset: 0;',
    '  width: 100%;',
    '  height: 100%;',
    '  object-fit: cover;',
    '}',
  ].join('\n') + '\n';

const historicStylesGitBlob = '7fd2802384a413cbb61b85c4f66f1bc344f9e35a';
const badImage = 'data:image/png;base64,aW52YWxpZA==';
type ImageState = 'absent' | 'failed' | 'failed-hidden' | 'loaded';

function avatarMarkup({
  state,
  fallback = 'JD',
  size = 'md',
  truncate = false,
  duplicateName = false,
}: {
  state: ImageState;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  truncate?: boolean;
  duplicateName?: boolean;
}) {
  const presentation = truncate
    ? '.fallback { min-width: 0; max-width: 100%; overflow: hidden; ' +
      'white-space: nowrap; text-overflow: ellipsis; text-align: center; }'
    : '';
  const pendingHide =
    state === 'failed-hidden' ? '.image { visibility: hidden; }' : '';
  const source =
    state === 'loaded'
      ? 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 ' +
        'width=%2210%22 height=%2210%22%3E%3Crect width=%2210%22 ' +
        'height=%2210%22 fill=%22%23005599%22/%3E%3C/svg%3E'
      : badImage;
  const image =
    state === 'absent'
      ? ''
      : '<img class="image" src="' +
        source +
        '" alt="' +
        (duplicateName ? 'Jordan Diaz' : '') +
        '" aria-hidden="' +
        (duplicateName ? 'false' : 'true') +
        '" />';
  const label = state === 'loaded' ? '' : fallback;

  return [
    '<!doctype html><html><head><style>',
    'body { font-family: Arial, sans-serif; --avatar-default-border: #aaaaaa;',
    ' --avatar-default-bg: #eeeeee; --avatar-default-fg: #111111; }',
    historicAvatarStyles,
    presentation,
    pendingHide,
    '</style></head><body>',
    '<div class="avatar ' + size + '" role="img" aria-label="Jordan Diaz">',
    '<span class="fallback" aria-hidden="true">' + label + '</span>',
    image,
    '</div></body></html>',
  ].join('');
}

async function renderFixture(
  page: Page,
  input: Parameters<typeof avatarMarkup>[0]
) {
  await page.setContent(avatarMarkup(input));
  if (input.state !== 'absent') {
    await expect
      .poll(() =>
        page.locator('.image').evaluate(
          (element, loaded) => {
            const img = element as HTMLImageElement;
            return (
              img.complete &&
              (loaded ? img.naturalWidth > 0 : img.naturalWidth === 0)
            );
          },
          input.state === 'loaded'
        )
      )
      .toBe(true);
  }
  await page.evaluate(() => document.fonts.ready);
  return page.locator('.avatar').screenshot({ animations: 'disabled' });
}

async function inspectFallbackLayout(page: Page) {
  return page.locator('.fallback').evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const root = element.parentElement!.getBoundingClientRect();
    return {
      whiteSpace: style.whiteSpace,
      textOverflow: style.textOverflow,
      overflow: style.overflow,
      withinRoot:
        bounds.left >= root.left &&
        bounds.right <= root.right &&
        bounds.top >= root.top &&
        bounds.bottom <= root.bottom,
      clippedText: element.scrollWidth > element.clientWidth,
    };
  });
}

test.describe('Avatar V2 browser oracle negative controls', () => {
  test.describe.configure({ retries: 0 });

  test('frozen failed image paints over fallback pixels', async ({ page }) => {
    const prefix = 'blob ' + Buffer.byteLength(historicAvatarStyles) + '\0';
    const hash = createHash('sha1')
      .update(prefix)
      .update(historicAvatarStyles)
      .digest('hex');
    expect(hash).toBe(historicStylesGitBlob);

    const baseline = await renderFixture(page, { state: 'absent' });
    const failed = await renderFixture(page, { state: 'failed' });
    // A genuine Chromium screenshot, not a DOM-text or JS visibility claim.
    // This is an intentionally failing **historical candidate** control.
    expect(failed.equals(baseline)).toBe(false);

    const repairedPresentation = await renderFixture(page, {
      state: 'failed-hidden',
    });
    expect(repairedPresentation.equals(baseline)).toBe(true);

    const loaded = await renderFixture(page, { state: 'loaded' });
    expect(loaded.equals(baseline)).toBe(false);
  });

  test('historical fallback wraps instead of truncating', async ({ page }) => {
    const words = 'Jordan Alexander Diaz Smith';
    await renderFixture(page, { state: 'absent', fallback: words, size: 'sm' });
    const historic = await inspectFallbackLayout(page);
    expect(historic.whiteSpace).not.toBe('nowrap');
    expect(historic.withinRoot).toBe(false);

    await renderFixture(page, {
      state: 'absent',
      fallback: words,
      size: 'sm',
      truncate: true,
    });
    const controlled = await inspectFallbackLayout(page);
    expect(controlled).toMatchObject({
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      withinRoot: true,
      clippedText: true,
    });
  });

  test('named root needs decorative children', async ({ page }) => {
    await renderFixture(page, { state: 'failed-hidden' });
    await expect(page.getByRole('img', { name: 'Jordan Diaz' })).toHaveCount(1);
    await expect(page.locator('.image')).toHaveAttribute('alt', '');
    await expect(page.locator('.image')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.fallback')).toHaveAttribute(
      'aria-hidden',
      'true'
    );

    await renderFixture(page, {
      state: 'failed-hidden',
      duplicateName: true,
    });
    // The parent img role makes descendants presentational in some ATs,
    // so inspect the raw duplicate accessible-name exposure as well.
    const duplicate = await page.locator('.avatar img').evaluate((node) => {
      const parentName = node.parentElement?.getAttribute('aria-label');
      return (
        node.getAttribute('alt') === parentName &&
        node.getAttribute('aria-hidden') !== 'true'
      );
    });
    expect(duplicate).toBe(true);
  });
});


test('TEMPORARY print exact Prettier output for the oracle', async () => {
  const prettier = await import('prettier');
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const filepath = fileURLToPath(import.meta.url);
  const original = readFileSync(filepath, 'utf8');
  const result = await prettier.format(original, { filepath });
  console.log('BEGIN_AVATAR_PRETTIER_FORMATTED_SOURCE');
  console.log(result);
  console.log('END_AVATAR_PRETTIER_FORMATTED_SOURCE');
});
