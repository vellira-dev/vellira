'use client';

import type { ReactNode } from 'react';
import NextLink from 'next/link';

import { ArrowLeft, ArrowRight } from '@vellira-ui/icons';
import { Button, type ButtonProps } from '@vellira-ui/react';

type BlogDesignSystemLinkProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  appearance?: Extract<ButtonProps['appearance'], 'link' | 'bare'>;
  color?: ButtonProps['color'];
  direction?: 'back' | 'forward';
  prefetch?: boolean;
  target?: ButtonProps['target'];
  rel?: ButtonProps['rel'];
  title?: string;
  'aria-label'?: string;
};

export function BlogDesignSystemLink({
  href,
  children,
  className,
  appearance = 'link',
  color = 'primary',
  direction,
  prefetch,
  target,
  rel,
  title,
  'aria-label': ariaLabel,
}: BlogDesignSystemLinkProps) {
  if (!href) return <>{children}</>;

  const iconStart =
    direction === 'back' ? <ArrowLeft size={16} aria-hidden='true' /> : undefined;
  const iconEnd =
    direction === 'forward' ? <ArrowRight size={16} aria-hidden='true' /> : undefined;
  const internal = href.startsWith('/');

  if (internal) {
    return (
      <Button
        asChild
        appearance={appearance}
        color={color}
        className={className}
        iconStart={iconStart}
        iconEnd={iconEnd}
        aria-label={ariaLabel}
        tooltip={title}
      >
        <NextLink href={href} prefetch={prefetch} target={target} rel={rel}>
          {children}
        </NextLink>
      </Button>
    );
  }

  return (
    <Button
      appearance={appearance}
      color={color}
      className={className}
      href={href}
      target={target}
      rel={rel}
      iconStart={iconStart}
      iconEnd={iconEnd}
      aria-label={ariaLabel}
      tooltip={title}
    >
      {children}
    </Button>
  );
}
