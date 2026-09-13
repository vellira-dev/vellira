'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Check,
  Copy,
  Eye,
  Facebook,
  Heart,
  HeartFilled,
  LinkedIn,
  Reddit,
  Share,
  X,
} from '@vellira-ui/icons';
import { Button, Portal, Tooltip } from '@vellira-ui/react';

import {
  fetchBlogArticleLike,
  fetchBlogMetrics,
  likeBlogArticle,
  registerBlogArticleView,
  unlikeBlogArticle,
  type BlogMetrics,
} from '../metrics';

import styles from './BlogArticleActions.module.css';

interface BlogArticleActionsProps {
  slug: string;
  title: string;
}

const SITE_URL = 'https://vellira.dev';
const ICON_SIZES = {
  heart: 18,
  eye: 19,
  share: 18,

  linkedin: 14,
  x: 13,
  facebook: 15,
  reddit: 15,

  copy: 22,
  check: 22,
} as const;
const pendingViewRegistrations = new Map<string, Promise<BlogMetrics | null>>();

function buildShareUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

function formatMetricCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

async function registerArticleViewOnce(
  slug: string
): Promise<BlogMetrics | null> {
  const pendingRegistration = pendingViewRegistrations.get(slug);

  if (pendingRegistration) {
    return pendingRegistration;
  }

  const registration = registerBlogArticleView(slug)
    .then((response) => response.metrics)
    .catch(() => null)
    .finally(() => {
      pendingViewRegistrations.delete(slug);
    });

  pendingViewRegistrations.set(slug, registration);

  return registration;
}

export function BlogArticleActions({ slug, title }: BlogArticleActionsProps) {
  const articleUrl = `${SITE_URL}/blog/${slug}`;
  const [metrics, setMetrics] = useState<BlogMetrics | null>(null);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [likePending, setLikePending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateMetrics() {
      try {
        const likeResult = await fetchBlogArticleLike(slug);

        if (cancelled) {
          return;
        }

        setLiked(likeResult.liked);
      } catch {
        // Leave actor-specific state unknown when the backend is unavailable.
      }

      const viewMetrics = await registerArticleViewOnce(slug);

      if (cancelled) {
        return;
      }

      if (viewMetrics) {
        setMetrics(viewMetrics);
        return;
      }

      try {
        const metricsResult = await fetchBlogMetrics(slug);

        if (!cancelled) {
          setMetrics(metricsResult);
        }
      } catch {
        // Keep the article readable without inventing a metric count.
      }
    }

    void hydrateMetrics();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const shareLinks = useMemo(
    () => [
      {
        label: 'LinkedIn',
        icon: (
          <span className={styles.iconSlot}>
            <LinkedIn size={ICON_SIZES.linkedin} aria-hidden='true' />
          </span>
        ),
        href: buildShareUrl('https://www.linkedin.com/sharing/share-offsite/', {
          url: articleUrl,
        }),
      },
      {
        label: 'X',
        icon: (
          <span className={styles.iconSlot}>
            <X size={ICON_SIZES.x} aria-hidden='true' />
          </span>
        ),
        href: buildShareUrl('https://twitter.com/intent/tweet', {
          text: title,
          url: articleUrl,
        }),
      },
      {
        label: 'Facebook',
        icon: (
          <span className={styles.iconSlot}>
            <Facebook size={ICON_SIZES.facebook} aria-hidden='true' />
          </span>
        ),
        href: buildShareUrl('https://www.facebook.com/sharer/sharer.php', {
          u: articleUrl,
        }),
      },
      {
        label: 'Reddit',
        icon: (
          <span className={styles.iconSlot}>
            <Reddit size={ICON_SIZES.reddit} aria-hidden='true' />
          </span>
        ),
        href: buildShareUrl('https://www.reddit.com/submit', {
          title,
          url: articleUrl,
        }),
      },
    ],
    [articleUrl, title]
  );

  async function toggleLike() {
    if (likePending) {
      return;
    }

    try {
      setLikePending(true);

      const result =
        liked === true
          ? await unlikeBlogArticle(slug)
          : await likeBlogArticle(slug);

      setMetrics(result.metrics);
      setLiked(result.liked);
    } catch {
      // Preserve the last known state instead of inventing a metric count.
    } finally {
      setLikePending(false);
    }
  }

  async function copyArticleLink() {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareArticle() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: articleUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    await copyArticleLink();
  }

  const likes = metrics ? formatMetricCount(metrics.likes) : null;
  const views = metrics ? formatMetricCount(metrics.views) : null;

  return (
    <aside className={styles.articleActions} aria-label='Article actions'>
      <div className={styles.articleActionsIntro}>
        <strong>Found this useful?</strong>
        <span>Like it or share it with another developer.</span>
      </div>

      <Tooltip.Provider delay={250}>
        <div className={styles.articleActionRow}>
          <Tooltip placement='top'>
            <Tooltip.Trigger asChild>
              <Button
                appearance='bare'
                type='button'
                className={`${styles.articleActionButton} ${styles.articleMetricButton} ${
                  liked ? styles.articleActionButtonActive : ''
                }`}
                aria-label={liked ? 'Unlike this article' : 'Like this article'}
                aria-pressed={liked === true}
                disabled={likePending}
                onClick={toggleLike}
              >
                {liked ? (
                  <span className={styles.iconSlot}>
                    <HeartFilled size={ICON_SIZES.heart} aria-hidden='true' />
                  </span>
                ) : (
                  <span className={styles.iconSlot}>
                    <Heart size={ICON_SIZES.heart} aria-hidden='true' />
                  </span>
                )}
                {likes !== null ? (
                  <span aria-label={`${likes} likes`} aria-live='polite'>
                    {likes}
                  </span>
                ) : null}
                <span className={styles.visuallyHidden}>
                  {liked ? 'Liked' : 'Like'}
                </span>
              </Button>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Content withArrow>
                {liked ? 'Unlike' : 'Like'}
              </Tooltip.Content>
            </Portal>
          </Tooltip>

          {views !== null ? (
            <Tooltip placement='top'>
              <Tooltip.Trigger asChild>
                <span
                  className={styles.articleMetricPill}
                  aria-label={`${views} views`}
                >
                  <span className={styles.iconSlot}>
                    <Eye size={ICON_SIZES.eye} aria-hidden='true' />
                  </span>
                  <span aria-hidden='true'>{views}</span>
                </span>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Content withArrow>Views</Tooltip.Content>
              </Portal>
            </Tooltip>
          ) : null}

          <Tooltip placement='top'>
            <Tooltip.Trigger asChild>
              <Button
                appearance='bare'
                type='button'
                className={`${styles.articleActionButton} ${styles.articleIconButton}`}
                aria-label='Share'
                onClick={shareArticle}
              >
                <span className={styles.iconSlot}>
                  <Share size={ICON_SIZES.share} aria-hidden='true' />
                </span>
              </Button>
            </Tooltip.Trigger>
            <Portal>
              <Tooltip.Content withArrow>Share</Tooltip.Content>
            </Portal>
          </Tooltip>

          <div
            className={styles.articleShareLinks}
            aria-label='Share this article'
          >
            {shareLinks.map((link) => (
              <Tooltip key={link.label} placement='top'>
                <Tooltip.Trigger asChild>
                  <a
                    className={styles.articleIconButton}
                    href={link.href}
                    target='_blank'
                    rel='noreferrer noopener'
                    aria-label={link.label}
                  >
                    {link.icon}
                  </a>
                </Tooltip.Trigger>
                <Portal>
                  <Tooltip.Content withArrow>{link.label}</Tooltip.Content>
                </Portal>
              </Tooltip>
            ))}

            <Tooltip placement='top'>
              <Tooltip.Trigger asChild>
                <Button
                  appearance='bare'
                  type='button'
                  className={styles.articleIconButton}
                  aria-label={copied ? 'Copied' : 'Copy link'}
                  onClick={copyArticleLink}
                >
                  {copied ? (
                    <span className={styles.iconSlot}>
                      <Check size={ICON_SIZES.check} aria-hidden='true' />
                    </span>
                  ) : (
                    <span className={styles.iconSlot}>
                      <Copy size={ICON_SIZES.copy} aria-hidden='true' />
                    </span>
                  )}
                </Button>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Content withArrow>
                  {copied ? 'Copied' : 'Copy link'}
                </Tooltip.Content>
              </Portal>
            </Tooltip>
          </div>
        </div>
      </Tooltip.Provider>
    </aside>
  );
}
