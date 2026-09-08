import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const dirname =
  typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const storybookRoot = path.resolve(dirname, '..');
const repositoryRoot = path.resolve(dirname, '../../..');
const reactRoot = path.resolve(repositoryRoot, 'node_modules/react');
const reactDomRoot = path.resolve(repositoryRoot, 'node_modules/react-dom');

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },

  stories: [
    '../../../packages/react/src/**/*.stories.@(ts|tsx|mdx)',
    '../../../packages/icons/src/**/*.stories.@(ts|tsx|mdx)',
  ],

  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
  ],

  staticDirs: [
    '../public',
    {
      from: '../../../packages/assets/brand/navigation',
      to: '/brand/navigation',
    },
  ],

  async viteFinal(config) {
    const merged = mergeConfig(config, {
      root: storybookRoot,
      resolve: {
        preserveSymlinks: true,
        dedupe: ['react', 'react-dom'],
        alias: [
          {
            find: '@vellira-ui/icons/lottie',
            replacement: path.resolve(
              dirname,
              '../../../packages/icons/src/lottie.ts'
            ),
          },
          {
            find: '@vellira-ui/icons',
            replacement: path.resolve(
              dirname,
              '../../../packages/icons/src/web.ts'
            ),
          },
          {
            find: '@vellira-ui/react/styles',
            replacement: path.resolve(
              dirname,
              '../../../packages/react/src/styles.ts'
            ),
          },
          {
            find: '@vellira-ui/react',
            replacement: path.resolve(
              dirname,
              '../../../packages/react/src/index.ts'
            ),
          },
          {
            find: '@vellira-ui/core',
            replacement: path.resolve(
              dirname,
              '../../../packages/core/src/index.ts'
            ),
          },
        ],
      },
      build: {
        chunkSizeWarningLimit: 1200,
      },
    });

    const existingAliases = merged.resolve?.alias;
    const aliases = Array.isArray(existingAliases)
      ? existingAliases
      : Object.entries(existingAliases ?? {}).map(([find, replacement]) => ({
          find,
          replacement,
        }));

    return {
      ...merged,
      resolve: {
        ...merged.resolve,
        preserveSymlinks: true,
        dedupe: ['react', 'react-dom', ...(merged.resolve?.dedupe ?? [])],
        alias: [
          {
            find: 'react-dom',
            replacement: reactDomRoot,
          },
          {
            find: 'react',
            replacement: reactRoot,
          },
          ...aliases,
        ],
      },
    };
  },
};

export default config;
