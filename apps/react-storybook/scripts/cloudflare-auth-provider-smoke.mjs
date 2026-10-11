import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const websiteInput = process.env.WEBSITE_URL;
const apiInput = process.env.AUTH_API_URL || 'https://api.vellira.dev';

if (!websiteInput) throw new Error('WEBSITE_URL is required');

const website = new URL(websiteInput);
const api = new URL(apiInput);
for (const url of [website, api]) {
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
}

const providerNames = {
  google: 'Google',
  apple: 'Apple',
  github: 'GitHub',
};
const providerOrder = ['google', 'apple', 'github'];

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);
let response;
try {
  response = await fetch(new URL('/v1/auth/providers', api), {
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-cache',
      Origin: website.origin,
    },
    cache: 'no-store',
    redirect: 'error',
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeout);
}

if (!response.ok)
  throw new Error(
    `Auth provider metadata returned HTTP ${response.status} from ${api.origin}`
  );

const text = await response.text();
if (text.length > 1024)
  throw new Error('Auth provider metadata exceeded the bounded response size');

let payload;
try {
  payload = JSON.parse(text);
} catch {
  throw new Error('Auth provider metadata was not valid JSON');
}

if (
  !payload ||
  typeof payload !== 'object' ||
  !Array.isArray(payload.providers) ||
  payload.providers.length === 0 ||
  payload.providers.length > providerOrder.length ||
  !payload.providers.every(
    (provider) =>
      typeof provider === 'string' && providerOrder.includes(provider)
  ) ||
  new Set(payload.providers).size !== payload.providers.length
)
  throw new Error(
    `Invalid production auth provider metadata: ${JSON.stringify(payload)}`
  );

const expectedProviders = providerOrder.filter((provider) =>
  payload.providers.includes(provider)
);
if (JSON.stringify(payload.providers) !== JSON.stringify(expectedProviders))
  throw new Error(
    `Auth provider metadata order must be ${providerOrder.join(' -> ')}`
  );

const browser = await chromium.launch({ headless: true });
const evidence = {
  website: website.origin,
  api: api.origin,
  providers: expectedProviders,
  rendered: [],
  absent: [],
  passwordLoginVisible: false,
  consoleErrors: [],
  pageErrors: [],
};

try {
  const context = await browser.newContext();
  context.setDefaultTimeout(15000);
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));

  const navigation = await page.goto(new URL('/login', website).toString(), {
    waitUntil: 'domcontentloaded',
  });
  if (!navigation || navigation.status() !== 200)
    throw new Error(
      `Production login returned HTTP ${navigation?.status() ?? 'no response'}`
    );

  for (const provider of providerOrder) {
    const button = page.getByRole('button', {
      name: `Continue with ${providerNames[provider]}`,
      exact: true,
    });

    if (expectedProviders.includes(provider)) {
      await expect(button).toBeVisible();
      evidence.rendered.push(provider);
    } else {
      await expect(button).toHaveCount(0);
      evidence.absent.push(provider);
    }
  }

  await expect(
    page.getByRole('textbox', { name: 'Email', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true })
  ).toBeEnabled();
  evidence.passwordLoginVisible = true;

  if (evidence.pageErrors.length)
    throw new Error(
      `Login page emitted page errors: ${evidence.pageErrors.join(' | ')}`
    );

  const out = path.resolve('test-results/cloudflare-auth-provider-smoke');
  await mkdir(out, { recursive: true });
  await writeFile(
    path.join(out, 'evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
