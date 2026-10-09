'use client';

import type { ReactNode } from 'react';
import NextLink from 'next/link';

import { ArrowLeft, ArrowRight } from '@vellira-ui/icons';
import { Button, type ButtonProps } from '@vellira-ui/react';

export type DesignSystemLinkProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  appearance?: Extract<ButtonProps['appearance'], 'link' | 'bare'>;
  color?: ButtonProps['color'];
  direction?: 'back' | 'forward';
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  prefetch?: boolean;
  target?: ButtonProps['target'];
  rel?: ButtonProps['rel'];
  title?: string;
  'aria-label'?: string;
};

export function DesignSystemLink({
  href,
  children,
  className,
  appearance = 'link',
  color = 'primary',
  direction,
  iconStart,
  iconEnd,
  prefetch,
  target,
  rel,
  title,
  'aria-label': ariaLabel,
}: DesignSystemLinkProps) {
  if (!href) return <>{children}</>;

  const resolvedIconStart =
    iconStart ??
    (direction === 'back' ? (
      <ArrowLeft size={16} aria-hidden='true' />
    ) : undefined);
  const resolvedIconEnd =
    iconEnd ??
    (direction === 'forward' ? (
      <ArrowRight size={16} aria-hidden='true' />
    ) : undefined);
  const internal = href.startsWith('/');

  if (internal) {
    return (
      <Button
        asChild
        appearance={appearance}
        color={color}
        className={className}
        iconStart={resolvedIconStart}
        iconEnd={resolvedIconEnd}
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
      iconStart={resolvedIconStart}
      iconEnd={resolvedIconEnd}
      aria-label={ariaLabel}
      tooltip={title}
    >
      {children}
    </Button>
  );
}
