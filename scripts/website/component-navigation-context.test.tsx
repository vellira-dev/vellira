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
import { ComponentsIndexExperience } from '../../apps/website/src/component-catalog/shared/ComponentsIndexExperience/ComponentsIndexExperience';
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
      <output data-testid='session-status'>
        {context.workspaceSessionStatus}
      </output>
      <button
        type='button'
        onClick={() => context.setWorkspaceSessionStatus('ready')}
      >
        Session ready
      </button>
      <button
        type='button'
        onClick={() => context.setWorkspaceSessionStatus('unauthenticated')}
      >
        Session denied
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

it('keeps explorer geometry while pending without exposing workspace navigation', async () => {
  route.search = 'from=app';
  render(
    <ComponentNavigationProvider>
      <StateProbe />
      <ComponentsIndexExperience footer={<footer>Public footer</footer>}>
        <h1>Public component catalog</h1>
      </ComponentsIndexExperience>
    </ComponentNavigationProvider>
  );
  await waitFor(() =>
    expect(screen.getByTestId('requested')).toHaveTextContent('true')
  );
  expect(screen.getByTestId('session-status')).toHaveTextContent('loading');
  expect(document.querySelector('[data-component-explorer]')).not.toBeNull();
  expect(screen.queryByRole('link', { name: 'Back to workspace' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Session ready' }));
  expect(document.querySelector('[data-component-explorer]')).not.toBeNull();
  expect(
    screen.getByRole('link', { name: 'Back to workspace' })
  ).toBeInTheDocument();
});

it('reverts to public layout when the canonical session denies the context', async () => {
  route.search = 'from=app';
  render(
    <ComponentNavigationProvider>
      <StateProbe />
      <ComponentsIndexExperience footer={<footer>Public footer</footer>}>
        <h1>Public component catalog</h1>
      </ComponentsIndexExperience>
    </ComponentNavigationProvider>
  );
  await waitFor(() =>
    expect(document.querySelector('[data-component-explorer]')).not.toBeNull()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Session denied' }));
  expect(screen.getByTestId('granted')).toHaveTextContent('false');
  expect(document.querySelector('[data-component-explorer]')).toBeNull();
  expect(
    screen.getByRole('heading', { name: 'Public component catalog' })
  ).toBeVisible();
});
