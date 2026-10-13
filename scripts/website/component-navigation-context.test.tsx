// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ search: 'from=app' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/components',
  useSearchParams: () => new URLSearchParams(route.search),
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
  route.search = 'from=app';
});

function StateProbe() {
  const context = useComponentNavigation();
  const requested = String(context.workspaceContextRequested);
  const granted = String(context.fromWorkspace);

  return (
    <>
      <output data-testid='requested'>{requested}</output>
      <output data-testid='granted'>{granted}</output>
      <button
        type='button'
        onClick={() => context.setWorkspaceSessionReady(true)}
      >
        Session ready
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

function OpeningPublicDrawer() {
  const { open, openNavigation } = useComponentNavigation();
  useLayoutEffect(() => {
    openNavigation();
  }, [openNavigation]);
  return <output data-testid='public-drawer-open'>{String(open)}</output>;
}

it('does not dismiss an early public drawer on initial URL reconciliation', async () => {
  route.search = '';
  render(
    <ComponentNavigationProvider>
      <OpeningPublicDrawer />
    </ComponentNavigationProvider>
  );
  await waitFor(() => {
    expect(screen.getByTestId('public-drawer-open')).toHaveTextContent('true');
  });
});

function expectButtonLinks(href: string) {
  const links = document.querySelectorAll('a[href^="/components/button"]');
  expect(links.length).toBeGreaterThan(1);
  for (const link of links) {
    expect(link.getAttribute('href')).toBe(href);
  }
}

it('preserves requested links during session loading', async () => {
  render(<CatalogFixture />);
  await waitFor(() => {
    expect(screen.getByTestId('requested')).toHaveTextContent('true');
  });
  expect(screen.getByTestId('granted')).toHaveTextContent('false');
  expectButtonLinks('/components/button?from=app');
});

it('reacts to same-path query without carrying session authority', async () => {
  const view = render(<CatalogFixture />);
  await waitFor(() => {
    expect(screen.getByTestId('requested')).toHaveTextContent('true');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Session ready' }));
  expect(screen.getByTestId('granted')).toHaveTextContent('true');

  route.search = '';
  view.rerender(<CatalogFixture />);
  await waitFor(() => {
    expect(screen.getByTestId('requested')).toHaveTextContent('false');
  });
  expect(screen.getByTestId('granted')).toHaveTextContent('false');
  expectButtonLinks('/components/button');

  route.search = 'from=app';
  view.rerender(<CatalogFixture />);
  await waitFor(() => {
    expect(screen.getByTestId('requested')).toHaveTextContent('true');
  });
  expect(screen.getByTestId('granted')).toHaveTextContent('false');
  expectButtonLinks('/components/button?from=app');
});
