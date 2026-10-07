import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootstrapPersonalWorkspace,
  listWorkspaces,
  login,
  verifyEmail,
} from '../../apps/website/src/product-app/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Vellira App browser API contract', () => {
  it('uses credentialed no-store login against the canonical API', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ authenticated: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    await login('person@example.com', 'long enough password');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vellira.dev/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          email: 'person@example.com',
          password: 'long enough password',
        }),
      })
    );
  });

  it('lists workspaces with a safe credentialed read', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ workspaces: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    await listWorkspaces();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vellira.dev/v1/workspaces',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
      })
    );
  });

  it('retrieves session CSRF before personal workspace bootstrap', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ csrfToken: 'csrf-value' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            workspace: {
              id: 'workspace',
              name: 'Personal workspace',
              status: 'active',
              membership: { role: 'owner' },
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    await bootstrapPersonalWorkspace();

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.vellira.dev/v1/auth/csrf'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      'https://api.vellira.dev/v1/workspaces/bootstrap'
    );

    const init = fetchMock.mock.calls[1]?.[1];
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      })
    );
    expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('csrf-value');
  });

  it('consumes verification secrets only in a JSON POST body', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ verified: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    await verifyEmail('secret-token');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.vellira.dev/v1/auth/email/verify');
    expect(String(url)).not.toContain('secret-token');
    expect(init?.body).toBe(JSON.stringify({ token: 'secret-token' }));
  });
});

describe('Vellira App first-party UI contract', () => {
  const root = process.cwd();
  const sources = [
    'apps/website/src/product-app/AppShell.tsx',
    'apps/website/src/product-app/AuthFlows.tsx',
  ];

  it('does not introduce native control substitutes for canonical Vellira UI', () => {
    for (const relativePath of sources) {
      const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
      expect(source).not.toMatch(/<(?:button|input|select|textarea)\b/u);
      expect(source).not.toMatch(
        /from ['"](?:@radix-ui|@mui|@chakra-ui|antd|react-bootstrap)/u
      );
    }
  });

  it('keeps auth text links on the canonical Vellira Button contract', () => {
    const signupPage = fs.readFileSync(
      path.join(root, 'apps/website/src/app/(auth)/signup/page.tsx'),
      'utf8'
    );
    const authTextLink = fs.readFileSync(
      path.join(root, 'apps/website/src/product-app/AuthTextLink.tsx'),
      'utf8'
    );

    expect(signupPage).not.toContain("from '@vellira-ui/react'");
    expect(signupPage).toContain("from '@/product-app/AuthTextLink'");

    expect(authTextLink.startsWith("'use client';")).toBe(true);
    expect(authTextLink).toContain("from '@vellira-ui/react'");
    expect(authTextLink).toContain("appearance='link'");
    expect(authTextLink).toContain("color='primary'");
    expect(authTextLink).toContain('iconStart={iconStart}');
    expect(authTextLink).not.toContain('AuthTextLink.module.css');
  });

  it('keeps verification and reset secrets in the browser fragment path', () => {
    const source = fs.readFileSync(
      path.join(root, 'apps/website/src/product-app/AuthFlows.tsx'),
      'utf8'
    );

    expect(source).toContain('window.location.hash');
    expect(source).toContain('window.history.replaceState');
    expect(source).not.toContain("searchParams.get('token')");
    expect(source).not.toContain('searchParams.get("token")');
  });
});
