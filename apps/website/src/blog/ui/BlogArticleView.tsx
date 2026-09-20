import Link from 'next/link';

import { Container } from '@/components/layout/Container';
import type { BlogArticle, BlogArticleMetadata } from '@/blog';
import { BlogArticleActions } from './BlogArticleActions';
import { BlogContinueReading } from './BlogContinueReading';
import { formatBlogDate } from './formatBlogDate';
import { BlogNewsletterSignup } from './BlogNewsletterSignup';

import responsive from './BlogArticleResponsive.module.css';
import styles from './BlogExperience.module.css';

interface BlogArticleViewProps {
  article: BlogArticle;
  relatedArticles?: readonly BlogArticleMetadata[];
}

export function BlogArticleView({
  article,
  relatedArticles = [],
}: BlogArticleViewProps) {
  const { metadata, Content } = article;

  return (
    <main className={styles.page}>
      <article className={`${styles.articlePage} ${responsive.articlePage}`}>
        <Container
          size='wide'
          className={`${styles.articleShell} ${responsive.articleShell}`}
        >
          <header
            className={`${styles.articleHeader} ${responsive.articleHeader}`}
          >
            <Link href='/blog' className={styles.backLink}>
              Back to blog
            </Link>

            <div className={styles.tags} aria-label='Article tags'>
              {metadata.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>

            <h1 className={responsive.articleTitle}>{metadata.title}</h1>
            <p
              className={`${styles.articleDescription} ${responsive.articleDescription}`}
            >
              {metadata.description}
            </p>

            <div className={`${styles.articleMeta} ${responsive.articleMeta}`}>
              <span>{metadata.author}</span>
              <span
                className={`${styles.metaDivider} ${responsive.metaDivider}`}
                aria-hidden='true'
              />
              <span>
                Published{' '}
                <time dateTime={metadata.publishedAt}>
                  {formatBlogDate(metadata.publishedAt)}
                </time>
              </span>

              {metadata.updatedAt && (
                <>
                  <span
                    className={`${styles.metaDivider} ${responsive.metaDivider}`}
                    aria-hidden='true'
                  />
                  <span>
                    Updated{' '}
                    <time dateTime={metadata.updatedAt}>
                      {formatBlogDate(metadata.updatedAt)}
                    </time>
                  </span>
                </>
              )}
            </div>
          </header>

          <div className={`${styles.articleBody} ${responsive.articleBody}`}>
            <Content />
          </div>

          <BlogArticleActions slug={metadata.slug} title={metadata.title} />
          <BlogContinueReading articles={relatedArticles} />
        </Container>
      </article>
      <BlogNewsletterSignup />
    </main>
  );
}
