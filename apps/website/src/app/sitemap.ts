import type { MetadataRoute } from 'next';

import { getPublishedBlogArticles } from '@/blog';
import { buildBlogSitemapEntries } from '@/blog/seo';
import { webComponents } from '@/component-catalog';

const SITE_URL = 'https://vellira.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const componentPages: MetadataRoute.Sitemap = webComponents.map(
    (component) => ({
      url: `${SITE_URL}/components/${component.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  );
  const blogArticles = await getPublishedBlogArticles();
  const blogPages = buildBlogSitemapEntries(blogArticles);

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },

    {
      url: `${SITE_URL}/components`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },

    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date('2026-10-10'),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    },

    ...['terms', 'cookies'].map((path) => ({
      url: `${SITE_URL}/${path}`,
      lastModified: new Date('2026-10-10'),
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),

    ...componentPages,
    ...blogPages,
  ];
}
