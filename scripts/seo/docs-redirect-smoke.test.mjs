import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  inspectLiveDocsRedirects,
  parseDocsRedirects,
  verifyLiveDocsRedirects,
} from './docs-redirect-smoke.mjs';

const fixture = [
  '/getting-started /start/getting-started 301',
  '/components/button /react/button 301',
].join('\n');

test('parses the real legacy redirect map with no ambiguous paths', async () => {
  const source = await readFile('apps/docs/src/public/_redirects', 'utf8');
  const rules = parseDocsRedirects(source);

  assert.ok(rules.size >= 40);
  assert.equal(rules.get('/getting-started'), '/start/getting-started');
  assert.equal(rules.get('/components/button'), '/react/button');
  assert.equal(rules.get('/components/button/'), '/react/button');
  // Radio now has independent canonical documentation and must not redirect.
  assert.equal(rules.has('/react/radio'), false);
  assert.equal(rules.has('/react/radio/'), false);
  assert.throws(
    () => parseDocsRedirects(fixture + '\n/getting-started /start/other 301'),
    /Duplicate documentation redirect/
  );
  assert.throws(
    () => parseDocsRedirects('/unsafe https://example.com/ 301'),
    /Invalid permanent documentation redirect/
  );
});

test('proves original URLs return exact 301 and canonical destinations return 200', async () => {
  const requests = [];
  const fetchImpl = async (input, options) => {
    const path = new URL(input).pathname;
    requests.push({ path, method: options.method, redirect: options.redirect });
    if (path === '/getting-started') {
      return new Response(null, {
        status: 301,
        headers: { location: '/start/getting-started' },
      });
    }
    if (path === '/components/button') {
      return new Response(null, {
        status: 301,
        headers: { location: 'https://docs.vellira.dev/react/button' },
      });
    }
    return new Response('<!doctype html>', { status: 200 });
  };

  const result = await inspectLiveDocsRedirects(parseDocsRedirects(fixture), {
    fetchImpl,
  });
  assert.deepEqual(result.failures, []);
  assert.equal(result.checkedSources, 2);
  assert.equal(result.checkedDestinations, 2);
  assert.equal(requests.length, 4);
  assert.ok(requests.every((request) => request.redirect === 'manual'));
});

test('fails closed for wrong locations, missing 301, and broken canonical target', async () => {
  const rules = parseDocsRedirects(fixture);
  const result = await inspectLiveDocsRedirects(rules, {
    fetchImpl: async (input) => {
      const path = new URL(input).pathname;
      if (path === '/getting-started') {
        return new Response(null, {
          status: 301,
          headers: { location: 'https://untrusted.example/redirect' },
        });
      }
      if (path === '/components/button') return new Response(null, { status: 404 });
      return new Response(null, { status: 404 });
    },
  });
  assert.equal(result.failures.length, 2);
  assert.match(result.failures[0].error, /expected 301/);

  const targetResult = await inspectLiveDocsRedirects(
    parseDocsRedirects('/getting-started /start/getting-started 301'),
    {
      fetchImpl: async (input) =>
        new URL(input).pathname === '/getting-started'
          ? new Response(null, { status: 301, headers: { location: '/start/getting-started' } })
          : new Response(null, { status: 404 }),
    }
  );
  assert.equal(targetResult.failures.length, 1);
  assert.match(targetResult.failures[0].error, /destination must return 200/);
});

test('bounds retries during Cloudflare propagation', async () => {
  let count = 0;
  let sleeps = 0;
  const result = await verifyLiveDocsRedirects(
    parseDocsRedirects('/getting-started /start/getting-started 301'),
    {
      attempts: 2,
      sleep: async () => { sleeps += 1; },
      fetchImpl: async (input) => {
        const path = new URL(input).pathname;
        if (path === '/start/getting-started') return new Response(null, { status: 200 });
        count += 1;
        return count === 1
          ? new Response(null, { status: 404 })
          : new Response(null, { status: 301, headers: { location: '/start/getting-started' } });
      },
    }
  );
  assert.equal(result.failures.length, 0);
  assert.equal(sleeps, 1);
  assert.equal(count, 2);
});
