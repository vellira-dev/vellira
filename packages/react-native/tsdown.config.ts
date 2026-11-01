import { readFileSync } from 'node:fs';

import { defineConfig } from 'tsdown';

// One shared graph for legacy root and the optional component entrypoints.
// Building these separately would duplicate ThemeContext and other singletons.
const subpaths = JSON.parse(
  readFileSync(new URL('./native-subpaths.json', import.meta.url), 'utf8')
) as Record<string, string>;

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    ...subpaths,
  },
  format: ['esm'],
  dts: false,
  clean: true,
  sourcemap: false,
  platform: 'neutral',
  target: 'es2022',
  outputOptions: {
    codeSplitting: true,
  },
  deps: {
    neverBundle: [
      'react',
      'react-native',
      '@vellira-ui/core',
      '@vellira-ui/icons',
      '@vellira-ui/tokens',
      '@vellira-ui/types',
    ],
  },
});
