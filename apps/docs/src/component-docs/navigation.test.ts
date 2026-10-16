import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { componentMetadata } from '../../../../packages/metadata/src/components';
import { componentDocsContracts } from './index';
import {
  assertUniqueComponentDocsSidebarItems,
  createGeneratedComponentDocsSidebarItems,
} from './navigation';

const docsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

describe('component docs navigation', () => {
  it.each(['react', 'react-native'] as const)(
    'keeps %s generated and reviewed independent links unique',
    (platform) => {
      const generated = createGeneratedComponentDocsSidebarItems({
        docsRoot,
        platform,
        metadata: componentMetadata,
        contracts: componentDocsContracts,
      });
      const items = assertUniqueComponentDocsSidebarItems({
        platform,
        items: [
          { text: 'Overview', link: `/${platform}/` },
          ...generated,
          { text: 'Portal', link: `/${platform}/portal` },
          { text: 'ThemeProvider', link: `/${platform}/theme-provider` },
        ],
      });

      const links = items.map((item) => item.link);
      expect(new Set(links).size).toBe(links.length);
      // Platform-specific contracts are valid; do not require every component
      // to have both React and React Native pages.
      const supportedNames = componentMetadata
        .filter((component) => component.platforms.includes(platform))
        .map((component) => component.name);
      expect(generated.map((item) => item.text)).toEqual(supportedNames);
      expect(links).toContain(`/${platform}/radio-group`);
      expect(links).toContain(`/${platform}/portal`);
      expect(links).toContain(`/${platform}/theme-provider`);
    }
  );

  it('rejects duplicate links deterministically', () => {
    expect(() =>
      assertUniqueComponentDocsSidebarItems({
        platform: 'react',
        items: [
          { text: 'Button', link: '/react/button' },
          { text: 'Another Button', link: '/react/button' },
          { text: 'Input', link: '/react/input' },
          { text: 'Another Input', link: '/react/input' },
        ],
      })
    ).toThrow(
      'Duplicate react component docs navigation links: /react/button, /react/input.'
    );
  });
});
