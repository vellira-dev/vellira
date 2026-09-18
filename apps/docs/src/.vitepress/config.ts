import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vitepress';

import {
  componentDocsContracts,
  createGeneratedComponentDocsSidebarItems,
  resolveComponentDocsRoot,
} from '../component-docs';
import { componentMetadata } from '../../../../packages/metadata/src/components';

const siteUrl = 'https://docs.vellira.dev';
const siteDescription =
  'TypeScript-first design system documentation for React and React Native applications.';
const socialImage = `${siteUrl}/brand/social/vellira-og-code-to-ui.png`;
const docsSiteNameJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${siteUrl}/#website`,
  url: `${siteUrl}/`,
  name: 'Vellira Docs',
  alternateName: ['docs.vellira.dev'],
}).replace(/</g, '\\u003c');
const navigationIcon = (name: string) =>
  readFileSync(
    resolve(process.cwd(), '../../packages/assets/brand/navigation', name),
    'utf8'
  )
    .replaceAll('fill="black"', 'fill="currentColor"')
    .replaceAll('fill="#1B1F23"', 'fill="currentColor"')
    .replaceAll('stroke="black"', 'stroke="currentColor"')
    .replaceAll('stroke="#1B1F23"', 'stroke="currentColor"');

const pageUrl = (relativePath: string) => {
  const path = relativePath.replace(/index\.md$/, '').replace(/\.md$/, '');

  return new URL(path, `${siteUrl}/`).toString();
};

const docsRoot = resolveComponentDocsRoot(import.meta.url);
const reactGeneratedComponentItems = createGeneratedComponentDocsSidebarItems({
  docsRoot,
  platform: 'react',
  metadata: componentMetadata,
  contracts: componentDocsContracts,
});
const reactNativeGeneratedComponentItems =
  createGeneratedComponentDocsSidebarItems({
    docsRoot,
    platform: 'react-native',
    metadata: componentMetadata,
    contracts: componentDocsContracts,
  });

export default defineConfig({
  title: 'Vellira Docs',
  titleTemplate: ':title | Vellira Docs',
  base: '/',
  description: siteDescription,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: siteUrl,
  },
  transformPageData(pageData) {
    const canonicalUrl = pageUrl(pageData.relativePath);
    const isHome = pageData.relativePath === 'index.md';

    const pageTitle =
      pageData.frontmatter.title || pageData.title || 'Vellira Documentation';

    const socialTitle = isHome ? pageTitle : `${pageTitle} | Vellira Docs`;

    const description = pageData.frontmatter.description || siteDescription;

    pageData.frontmatter.head ??= [];

    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:title', content: socialTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { name: 'twitter:title', content: socialTitle }],
      ['meta', { name: 'twitter:description', content: description }]
    );

    if (isHome) {
      pageData.frontmatter.head.push([
        'script',
        { type: 'application/ld+json' },
        docsSiteNameJsonLd,
      ]);
    }
  },
  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/brand/icons/favicon.svg',
      },
    ],
    ['link', { rel: 'icon', href: '/brand/icons/favicon.ico' }],
    [
      'link',
      {
        rel: 'icon',
        sizes: '32x32',
        href: '/brand/icons/favicon-32x32.png',
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        sizes: '16x16',
        href: '/brand/icons/favicon-16x16.png',
      },
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        href: '/brand/app-icons/vellira-apple-touch-icon.png',
      },
    ],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'Vellira Docs' }],
    ['meta', { property: 'og:image', content: socialImage }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: 'Vellira design system documentation',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: socialImage }],
  ],
  themeConfig: {
    siteTitle: false,
    logo: {
      light: '/brand/logos/vellira-dark.svg',
      dark: '/brand/logos/vellira-light.svg',
      alt: 'Vellira Docs',
    },
    nav: [
      { text: 'Quick Start', link: '/start/getting-started' },
      { text: 'React', link: '/react/' },
      { text: 'React Native', link: '/react-native/' },
      { text: 'Icons', link: '/icons/' },
      { text: 'Tokens', link: '/design-system/tokens' },
      { text: 'Production', link: '/start/production' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Quick Start', link: '/start/getting-started' },
          {
            text: 'Component Overview',
            link: '/start/component-overview',
          },
          { text: 'Production', link: '/start/production' },
          { text: 'Project Sites', link: '/start/project-sites' },
        ],
      },
      {
        text: 'React',
        items: [
          { text: 'Overview', link: '/react/' },
          { text: 'Button', link: '/react/button' },
          { text: 'Input', link: '/react/input' },
          { text: 'Checkbox', link: '/react/checkbox' },
          ...reactGeneratedComponentItems,
          { text: 'RadioGroup', link: '/react/radio-group' },
          { text: 'Select', link: '/react/select' },
          { text: 'FormField', link: '/react/form-field' },
          { text: 'Dropdown', link: '/react/dropdown' },
          { text: 'Tabs', link: '/react/tabs' },
          { text: 'Popover', link: '/react/popover' },
          { text: 'Tooltip', link: '/react/tooltip' },
          { text: 'Modal', link: '/react/modal' },
          { text: 'Portal', link: '/react/portal' },
          { text: 'ThemeProvider', link: '/react/theme-provider' },
        ],
      },
      {
        text: 'React Native',
        items: [
          { text: 'Overview', link: '/react-native/' },
          { text: 'Button', link: '/react-native/button' },
          { text: 'Input', link: '/react-native/input' },
          { text: 'Checkbox', link: '/react-native/checkbox' },
          ...reactNativeGeneratedComponentItems,
          { text: 'RadioGroup', link: '/react-native/radio-group' },
          { text: 'Select', link: '/react-native/select' },
          { text: 'FormField', link: '/react-native/form-field' },
          { text: 'Dropdown', link: '/react-native/dropdown' },
          { text: 'Tabs', link: '/react-native/tabs' },
          { text: 'Popover', link: '/react-native/popover' },
          { text: 'Tooltip', link: '/react-native/tooltip' },
          { text: 'Modal', link: '/react-native/modal' },
          { text: 'Portal', link: '/react-native/portal' },
          { text: 'ThemeProvider', link: '/react-native/theme-provider' },
        ],
      },
      {
        text: 'Icons',
        items: [
          { text: 'Overview', link: '/icons/' },
          { text: 'Static', link: '/icons/static' },
          { text: 'Animated', link: '/icons/animated' },
          { text: 'Usage', link: '/icons/usage' },
        ],
      },
      {
        text: 'Design System',
        items: [
          { text: 'Tokens', link: '/design-system/tokens' },
          {
            text: 'Theme Architecture',
            link: '/design-system/theme-architecture',
          },
          {
            text: 'Accessibility',
            link: '/design-system/accessibility',
          },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Quality', link: '/project/quality' },
          { text: 'Contributing', link: '/project/contributing' },
        ],
      },
    ],
    socialLinks: [
      {
        icon: { svg: navigationIcon('website.svg') },
        link: 'https://vellira.dev',
      },
      {
        icon: { svg: navigationIcon('github.svg') },
        link: 'https://github.com/vellira-dev/vellira',
      },
      {
        icon: { svg: navigationIcon('storybook.svg') },
        link: 'https://storybook.vellira.dev',
      },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Built for Vellira Design System.',
      copyright: 'MIT Licensed.',
    },
  },
});
