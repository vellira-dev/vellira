import type { BlogArticleMetadata } from '../types';
import { BlogDesignSystemLink } from './BlogDesignSystemLink';
import { formatBlogDate } from './formatBlogDate';

import styles from './BlogContinueReading.module.css';

interface BlogContinueReadingProps {
  articles: readonly BlogArticleMetadata[];
}

export function BlogContinueReading({ articles }: BlogContinueReadingProps) {
  const visibleArticles = articles.slice(0, 3);

  if (visibleArticles.length === 0) {
    return null;
  }

  return (
    <section
      className={styles.section}
      aria-labelledby='blog-continue-reading-heading'
    >
      <div className={styles.headingGroup}>
        <p className={styles.eyebrow}>Keep exploring</p>
        <h2 id='blog-continue-reading-heading' className={styles.heading}>
          Continue reading
        </h2>
      </div>

      <div className={styles.grid}>
        {visibleArticles.map((article) => (
          <BlogDesignSystemLink
            key={article.slug}
            href={`/blog/${article.slug}`}
            appearance='bare'
            className={styles.card}
            aria-label={`Read ${article.title}`}
          >
            <time className={styles.date} dateTime={article.publishedAt}>
              {formatBlogDate(article.publishedAt)}
            </time>

            <h3 className={styles.cardTitle}>{article.title}</h3>
            <p className={styles.description}>{article.description}</p>

            <div className={styles.tags} aria-hidden='true'>
              {article.tags.slice(0, 3).map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>

            <span className={styles.cta}>Read article</span>
          </BlogDesignSystemLink>
        ))}
      </div>

      <BlogDesignSystemLink
        href='/blog'
        color='neutral'
        direction='forward'
        className={styles.viewAll}
      >
        View all articles
      </BlogDesignSystemLink>
    </section>
  );
}
