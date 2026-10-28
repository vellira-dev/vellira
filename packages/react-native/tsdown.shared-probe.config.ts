import { defineConfig } from 'tsdown';

// Opt-in experiment only. Does not affect the canonical root build or npm files.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    button: 'src/primitives/Button/index.ts',
    theme: 'src/theme/index.ts',
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
