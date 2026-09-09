import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

const withMDX = createMDX({});
const deploymentBuildId =
  process.env.VELLIRA_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim();

const nextConfig: NextConfig = {
  devIndicators: false,
  generateBuildId: async () => deploymentBuildId || 'local',
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
