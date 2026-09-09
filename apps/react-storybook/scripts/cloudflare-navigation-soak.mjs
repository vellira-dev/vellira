/* global window */
import { chromium } from '@playwright/test';
import path from 'node:path';
import {
  captureDiagnostics,
  waitForRoute,
} from './cloudflare-browser-diagnostics.mjs';

const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');
// With 14 component routes and 6 articles, 15 rounds with a one-second dwell
// cross the observed 300-second router stale-time within one browser document.
const rounds = Number(process.env.SOAK_ROUNDS ?? 15);
const dwellMs = Number(process.env.SOAK_DWELL_MS ?? 1_000);
if (
  !Number.isInteger(rounds) ||
  rounds < 1 ||
  !Number.isFinite(dwellMs) ||
  dwellMs < 0
) {
  throw new Error(
    'SOAK_ROUNDS must be positive and SOAK_DWELL_MS nonnegative.'
  );
}
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const page = await context.newPage();
const directory = path.resolve(
  process.env.SOAK_ARTIFACT_DIR ?? 'test-results/cloudflare-soak'
);
const diagnostics = await captureDiagnostics(page, context, baseUrl, directory);
const sidebarSelector = 'aside[aria-label="Component navigation"]';
let documentToken;

async function ready(href, title) {
  await waitForRoute(page, diagnostics, baseUrl, href, title);
  if (
    documentToken &&
    (await page.evaluate(() => window.__velliraSoakDocument)) !== documentToken
  ) {
    throw new Error(`Client navigation replaced the document at ${href}`);
  }
  await page.waitForTimeout(dwellMs);
  diagnostics.assertHealthy(`settled ${href}`);
}

async function click(link, href, title) {
  diagnostics.record('navigation', { href, title });
  await link.click({ timeout: 15_000 });
  await ready(href, title);
}

async function components() {
  const sidebar = page.locator(sidebarSelector).first();
  await sidebar.waitFor({ state: 'visible', timeout: 15_000 });
  const targets = await sidebar
    .locator('a[href^="/components/"]')
    .evaluateAll((links) =>
      Array.from(
        new Map(
          links.map((link) => [
            link.getAttribute('href'),
            {
              href: link.getAttribute('href'),
              title: link.textContent.trim(),
            },
          ])
        ).values()
      )
    );
  if (targets.length < 5)
    throw new Error(
      `Expected at least 5 component routes, got ${targets.length}`
    );
  for (let round = 1; round <= rounds; round++) {
    for (const { href, title } of targets) {
      await click(
        page.locator(`${sidebarSelector} a[href="${href}"]`).first(),
        href,
        title
      );
    }
    await diagnostics.anchor(`component round ${round}`);
    console.log(
      `OK component round ${round}/${rounds}: ${targets.length} routes`
    );
  }
}

async function blog() {
  await click(page.locator('header a[href="/blog"]').first(), '/blog', 'Blog');
  const targets = await page
    .locator('main a[href^="/blog/"]')
    .evaluateAll((links) =>
      Array.from(
        new Map(
          links
            .filter((link) => link.closest('article')?.querySelector('h2'))
            .map((link) => [
              link.getAttribute('href'),
              {
                href: link.getAttribute('href'),
                title: link
                  .closest('article')
                  ?.querySelector('h2')
                  .textContent.trim(),
              },
            ])
        ).values()
      ).slice(0, 6)
    );
  if (targets.length < 3)
    throw new Error(`Expected at least 3 blog routes, got ${targets.length}`);
  for (let round = 1; round <= rounds; round++) {
    for (const { href, title } of targets) {
      await click(page.locator(`main a[href="${href}"]`).first(), href, title);
      // History preserves the loaded runtime/router caches, unlike page.goto('/blog').
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15_000 });
      await ready('/blog', 'Blog');
    }
    await diagnostics.anchor(`blog round ${round}`);
    console.log(`OK blog round ${round}/${rounds}: ${targets.length} routes`);
  }
}

let failure;
try {
  await diagnostics.anchor('start');
  const response = await page.goto(
    new URL('/components/switch', baseUrl).href,
    {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    }
  );
  if (!response?.ok())
    throw new Error(
      `Initial document status=${response?.status() ?? 'no-response'} URL=${page.url()}`
    );
  await ready('/components/switch', 'Switch');
  documentToken = await page.evaluate(
    () => (window.__velliraSoakDocument = crypto.randomUUID())
  );
  await components();
  await blog();
  await page.waitForTimeout(5_000);
  diagnostics.assertHealthy('final preload settle');
} catch (error) {
  failure = error;
  console.error(`Cloudflare navigation soak failed at ${page.url()}`, error);
  process.exitCode = 1;
} finally {
  try {
    await diagnostics.finish(failure);
    diagnostics.assertHealthy('diagnostic capture settle');
    if (!failure) {
      console.log(
        'OK Cloudflare navigation soak: no delayed /_next/static asset failures'
      );
    }
  } finally {
    await browser.close();
  }
}
