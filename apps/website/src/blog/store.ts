import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { getBlogArticleMetadataRegistryEntries } from './article-modules';
import {
  assertBlogSlug,
  assertUniqueBlogSlugs,
  parseBlogArticleMetadata,
  sortBlogArticleMetadata,
} from './schema';
import type { BlogArticleMetadata } from './types';

const METADATA_FILE = 'metadata.json';
const ARTICLE_FILE = 'article.mdx';

function resolveBlogContentDirectory(): string {
  const cwd = process.cwd();
  const packageLocalDirectory = path.join(cwd, 'content', 'blog');

  if (cwd.endsWith(path.join('apps', 'website'))) {
    return packageLocalDirectory;
  }

  return path.join(cwd, 'apps', 'website', 'content', 'blog');
}

export const BLOG_CONTENT_DIRECTORY = resolveBlogContentDirectory();

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function assertArticleBodyExists(
  articleDirectory: string
): Promise<void> {
  const articlePath = path.join(articleDirectory, ARTICLE_FILE);

  try {
    const articleStat = await stat(articlePath);

    if (!articleStat.isFile()) {
      throw new Error(`${articlePath}: expected a file`);
    }
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`${articlePath}: missing required article body`);
    }

    throw error;
  }
}

async function readArticleMetadata(
  articleDirectory: string,
  directorySlug: string
): Promise<BlogArticleMetadata> {
  const metadataPath = path.join(articleDirectory, METADATA_FILE);
  let rawMetadata: string;

  try {
    rawMetadata = await readFile(metadataPath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`${metadataPath}: missing required metadata file`);
    }

    throw error;
  }

  let parsedMetadata: unknown;

  try {
    parsedMetadata = JSON.parse(rawMetadata) as unknown;
  } catch {
    throw new Error(`${metadataPath}: metadata must contain valid JSON`);
  }

  const metadata = parseBlogArticleMetadata(parsedMetadata, metadataPath);

  if (metadata.slug !== directorySlug) {
    throw new Error(
      `${metadataPath}: metadata slug ${metadata.slug} must match directory ${directorySlug}`
    );
  }

  return metadata;
}

export async function readBlogArticleMetadataFromDirectory(
  contentDirectory: string
): Promise<BlogArticleMetadata[]> {
  let entries;

  try {
    entries = await readdir(contentDirectory, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(
        `${contentDirectory}: blog content directory does not exist`
      );
    }

    throw error;
  }

  const articleDirectories = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name));

  const metadata: BlogArticleMetadata[] = [];

  for (const directory of articleDirectories) {
    const directorySlug = assertBlogSlug(
      directory.name,
      path.join(contentDirectory, directory.name)
    );
    const articleDirectory = path.join(contentDirectory, directory.name);

    await assertArticleBodyExists(articleDirectory);
    metadata.push(await readArticleMetadata(articleDirectory, directorySlug));
  }

  assertUniqueBlogSlugs(metadata, contentDirectory);

  return metadata;
}

export function getPublishedBlogArticleMetadataFromCorpus(
  articles: readonly BlogArticleMetadata[]
): BlogArticleMetadata[] {
  assertUniqueBlogSlugs(articles);

  return sortBlogArticleMetadata(articles.filter((article) => !article.draft));
}

export async function readPublishedBlogArticleMetadataFromDirectory(
  contentDirectory: string
): Promise<BlogArticleMetadata[]> {
  const metadata = await readBlogArticleMetadataFromDirectory(contentDirectory);
  return getPublishedBlogArticleMetadataFromCorpus(metadata);
}

function readRegisteredBlogArticleMetadata(): BlogArticleMetadata[] {
  const metadata = getBlogArticleMetadataRegistryEntries().map((entry) => {
    const source = `blog registry:${entry.slug}`;
    const parsed = parseBlogArticleMetadata(entry.metadata, source);

    if (parsed.slug !== entry.slug) {
      throw new Error(
        `${source}: metadata slug ${parsed.slug} must match registry slug ${entry.slug}`
      );
    }

    return parsed;
  });

  assertUniqueBlogSlugs(metadata, 'blog registry');
  return metadata;
}

export async function getPublishedBlogArticles(): Promise<
  BlogArticleMetadata[]
> {
  return getPublishedBlogArticleMetadataFromCorpus(
    readRegisteredBlogArticleMetadata()
  );
}

export async function getPublishedBlogArticleMetadata(
  slug: string
): Promise<BlogArticleMetadata | null> {
  assertBlogSlug(slug);

  const metadata = readRegisteredBlogArticleMetadata();
  const article = metadata.find((candidate) => candidate.slug === slug);

  if (article === undefined || article.draft) {
    return null;
  }

  return article;
}
