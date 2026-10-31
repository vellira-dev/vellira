import { fileURLToPath } from 'node:url';

import createMDX from '@next/mdx';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { deploymentIdentity } from './cloudflare/build-identity.mjs';

const withMDX = createMDX({});

// These adapters are resolved only by the browser-hosted Native Starter.
// The Expo native build and library itself remain unchanged.
const nativeAdapter = (name: string) =>
  fileURLToPath(
    new URL(
      './src/sections/home/ProductInterfaceDemo/native-web-adapters/' + name,
      import.meta.url
    )
  );
const nativeWebAdapters = {
  'expo-blur': nativeAdapter('ExpoBlur.tsx'),
  'react-native-safe-area-context': nativeAdapter('SafeArea.tsx'),
  '@react-native-async-storage/async-storage': nativeAdapter('AsyncStorage.ts'),
};
const deploymentBuildId = deploymentIdentity();

const nextConfig: NextConfig = {
  devIndicators: false,
  generateBuildId: async () => deploymentBuildId,
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
      ...nativeWebAdapters,
    },
  },

  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      'react-native$': 'react-native-web',
      ...nativeWebAdapters,
    };
    return config;
  },
};

export default async function config(phase: string) {
  // Runtime secrets belong to the Worker, not to static builds or `next start`.
  // Keep the canonical Wrangler config (and missing-secret warnings) in dev.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    await initOpenNextCloudflareForDev();
  }
  return withMDX(nextConfig);
}
