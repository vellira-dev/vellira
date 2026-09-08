import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const withMDX = createMDX({});

const nextConfig: NextConfig = {
  devIndicators: false,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  transpilePackages: [
    '@vellira-ui/react',
    '@vellira-ui/react-native',
    '@vellira-ui/tokens',
    '@vellira-ui/icons',
    '@vellira-ui/core',
    '@vellira-ui/types',
    'react-native-web',
  ],

  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
    },
  },
};

export default withMDX(nextConfig);
