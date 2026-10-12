// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ search: 'from=app' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/components',
  useSearchParams: () => new URLSearchParams(navigation.search),
}));
vi.mock(
  '../../apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentCatalogPreview',
  () => ({ ComponentCatalogPreview: () => null })
);

import {
  ComponentNavigationProvider,
  useComponentNavigation,
} from '../../apps/website/src/component-catalog/shared/ComponentNavigationProvider';
import { ComponentsCatalog } from '../../apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentsCatalog';
import { ComponentSidebar } from '../../apps/website/src/component-catalog/shared/ComponentSidebar/ComponentSidebar';

afterEach(() => {
  cleanup();
  navigation.search = 'from=app';
});

function StateProbe() {
  const { workspaceContextRequested, fromWorkspace, setWorkspaceSessionReady } =
    useComponentNavigation();
  return (
    <>
      <output data-testid='context-requested'>
        {String(workspaceContextRequested)}
      </output>
      <output data-testid='context-granted'>{String(fromWorkspace)}</output>
      <button type='button' onClick={() => setWorkspaceSessionReady(true)}>
        Canonical session ready
      </button>
    </>
  );
}

function CatalogFixture() {
  return (
    <ComponentNavigationProvider>
      <StateProbe />
      <ComponentSidebar />
      <ComponentsCatalog />
    </ComponentNavigationProvider>
  );
}

function componentLink(selector: string) {
  const link = document.querySelector<HTMLAnchorElement>(selector);
  expect(link).not.toBeNull();
  return link?.getAttribute('href');
}

it('keeps requested catalog links while session is loading', async () => {
  render(<CatalogFixture />);
  await waitFor(() =>
    expect(screen.getByTestId('context-requested')).toHaveTextContent('true')
  );
  expect(screen.getByTestId('context-granted')).toHaveTextContent('false');
  expect(
    componentLink(
      'aside[aria-label="Component navigation"] a[href*="/components/button"]'
    )
  ).toBe('/components/button?from=app');
  expect(
    componentLink('a[class*="card"][href*="/components/button"]')
  ).toBe('/components/button?from=app');
});

it('updates same-path query without carrying session authority', async () => {
  const view = render(<CatalogFixture />);
  await waitFor(() =>
    expect(screen.getByTestId('context-requested')).toHaveTextContent('true')
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Canonical session ready' })
  );
  expect(screen.getByTestId('context-granted')).toHaveTextContent('true');

  navigation.search = '';
  view.rerender(<CatalogFixture />);
  await waitFor(() =>
    expect(screen.getByTestId('context-requested')).toHaveTextContent('false')
  );
  expect(screen.getByTestId('context-granted')).toHaveTextContent('false');
  expect(
    componentLink('a[class*="card"][href*="/components/button"]')
  ).toBe('/components/button');

  navigation.search = 'from=app';
  view.rerender(<CatalogFixture />);
  await waitFor(() =>
    expect(screen.getByTestId('context-requested')).toHaveTextContent('true')
  );
  expect(screen.getByTestId('context-granted')).toHaveTextContent('false');
  expect(
    componentLink('a[class*="card"][href*="/components/button"]')
  ).toBe('/components/button?from=app');
});
