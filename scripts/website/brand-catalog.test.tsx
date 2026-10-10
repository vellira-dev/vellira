// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../../packages/icons/src/storybook/AnimatedIconPreview', () => ({
  AnimatedIconPreview: () => null,
}));
import { Static, All } from '../../packages/icons/src/storybook/Icons.stories';
afterEach(cleanup);
for (const [name, story] of Object.entries({ Static, All })) {
  it(`${name} advertises UI vocabulary without third-party brand marks`, () => {
    const Render = story.render!;
    render(<Render {...({} as Parameters<typeof Render>[0])} />);
    expect(
      screen.getAllByRole('heading', { name: 'Navigation' })[0]
    ).toBeInTheDocument();
    for (const label of [
      'Brand',
      'GitHub',
      'Storybook',
      'Facebook',
      'LinkedIn',
      'Reddit',
      'Google',
      'Apple',
      'DocsVellira',
    ])
      expect(screen.queryByText(label)).toBeNull();
  });
}
