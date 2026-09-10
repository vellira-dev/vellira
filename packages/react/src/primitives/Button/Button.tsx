import {
  cloneElement,
  type CSSProperties,
  forwardRef,
  isValidElement,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import { controlSizes } from '@vellira-ui/tokens';

import type { ButtonProps } from './types';

import styles from './Button.module.scss';

import { cn } from '#utils/cn';
import { devWarning } from '#utils/devWarning';

type ButtonChildProps = {
  children?: ReactNode;
  className?: string;
  href?: string;
  style?: CSSProperties;
  'aria-busy'?: boolean;
  'aria-disabled'?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  ref?: Ref<HTMLElement>;
  tabIndex?: number;
  title?: string;
};

type ButtonSizeStyle = CSSProperties & {
  '--button-height': string;
  '--button-font-size': string;
  '--button-line-height': string;
  '--icon-size': string;
};

export const Button = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  ButtonProps
>(
  (
    {
      children,
      color = 'primary',
      appearance = 'solid',
      size = 'md',
      shape = 'pill',
      type = 'button',
      disabled = false,
      loading = false,
      loadingText,
      iconStart,
      iconEnd,
      spinner,
      badge,
      shortcut,
      tooltip,
      fullWidth = false,
      iconOnly: iconOnlyProp = false,
      asChild = false,
      className,
      style,
      onClick,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      href,
      target,
      rel,
      download,
      id,
      role,
      tabIndex,
      ...props
    },
    ref
  ) => {
    const child =
      asChild && isValidElement<ButtonChildProps>(children)
        ? (children as ReactElement<ButtonChildProps>)
        : undefined;
    const visibleChildren = child ? child.props.children : children;
    const iconOnly =
      iconOnlyProp || (!visibleChildren && Boolean(iconStart || iconEnd));
    const hasAccessibleName = Boolean(
      ariaLabel ||
      ariaLabelledBy ||
      child?.props['aria-label'] ||
      child?.props['aria-labelledby']
    );

    const isDisabled = disabled || loading;
    const isBare = appearance === 'bare';
    const controlSize = controlSizes[size];

    const sizeStyle: ButtonSizeStyle = {
      '--button-height': `${controlSize.height}px`,
      '--button-font-size': `${controlSize.fontSize}px`,
      '--button-line-height': `${controlSize.lineHeight}px`,
      '--icon-size': `${controlSize.iconSize}px`,
    };

    const content = loading && loadingText ? loadingText : visibleChildren;
    const labelMeasure =
      loadingText &&
      visibleChildren &&
      !iconOnly &&
      (typeof visibleChildren === 'string' ||
        typeof visibleChildren === 'number') &&
      (typeof loadingText === 'string' || typeof loadingText === 'number')
        ? String(loading ? visibleChildren : loadingText)
        : undefined;
    const resolvedRel =
      target === '_blank' && !rel ? 'noreferrer noopener' : rel;
    const resolvedClassName = cn(
      isBare ? styles.bare : styles.button,
      !isBare ? styles[color] : null,
      !isBare ? styles[appearance] : null,
      !isBare ? styles[size] : null,
      !isBare ? styles[shape] : null,
      className,
      {
        [styles.disabled]: isDisabled,
        [styles.loading]: loading,
        [styles.fullWidth]: fullWidth,
        [styles.iconOnly]: iconOnly,
      }
    );

    devWarning(
      !asChild || !href,
      'Button: pass href to the child element when using asChild.'
    );

    devWarning(
      !asChild || Boolean(child),
      'Button: asChild requires a single valid React element child.'
    );

    devWarning(
      !iconOnly || hasAccessibleName,
      'Button: icon-only buttons must provide aria-label or aria-labelledby.'
    );

    const preventDisabledClick: MouseEventHandler<HTMLElement> = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleChildClick: MouseEventHandler<HTMLElement> = (event) => {
      if (isDisabled) {
        preventDisabledClick(event);
        return;
      }

      child?.props.onClick?.(event);

      if (!event.defaultPrevented) {
        (onClick as unknown as MouseEventHandler<HTMLElement> | undefined)?.(
          event
        );
      }
    };

    const inner = (
      <>
        {loading &&
          (spinner ? (
            <span className={styles.icon} aria-hidden='true'>
              {spinner}
            </span>
          ) : (
            <span className={styles.spinner} aria-hidden='true' />
          ))}
        {!loading && iconStart && (
          <span className={styles.icon}>{iconStart}</span>
        )}
        {content &&
          !iconOnly &&
          (isBare ? (
            content
          ) : (
            <span className={styles.label} data-measure={labelMeasure}>
              <span className={styles.labelText}>{content}</span>
            </span>
          ))}
        {badge &&
          !iconOnly &&
          (isBare ? badge : <span className={styles.badge}>{badge}</span>)}
        {shortcut &&
          !iconOnly &&
          (isBare ? (
            shortcut
          ) : (
            <span className={styles.shortcut}>{shortcut}</span>
          ))}
        {!loading && iconEnd && <span className={styles.icon}>{iconEnd}</span>}
      </>
    );

    if (child) {
      return cloneElement(child, {
        ...props,
        ref: ref as Ref<HTMLElement>,
        style: {
          ...sizeStyle,
          ...child.props.style,
          ...style,
        },
        'aria-busy': loading || undefined,
        'aria-disabled': isDisabled || undefined,
        'aria-label': ariaLabel || child.props['aria-label'] || undefined,
        'aria-labelledby':
          ariaLabelledBy || child.props['aria-labelledby'] || undefined,
        className: cn(child.props.className, resolvedClassName),
        href: isDisabled ? undefined : child.props.href,
        onClick: handleChildClick,
        tabIndex: isDisabled ? -1 : child.props.tabIndex,
        title: tooltip || child.props.title,
        children: inner,
      });
    }

    if (href) {
      return (
        <a
          ref={ref as Ref<HTMLAnchorElement>}
          href={isDisabled ? undefined : href}
          id={id}
          role={role}
          tabIndex={isDisabled ? -1 : tabIndex}
          target={target}
          rel={resolvedRel}
          download={download}
          onClick={
            isDisabled
              ? (preventDisabledClick as MouseEventHandler<HTMLAnchorElement>)
              : (onClick as unknown as MouseEventHandler<HTMLAnchorElement>)
          }
          aria-disabled={isDisabled || undefined}
          aria-label={ariaLabel || undefined}
          aria-labelledby={ariaLabelledBy || undefined}
          aria-busy={loading || undefined}
          className={resolvedClassName}
          title={tooltip}
          style={{
            ...sizeStyle,
            ...style,
          }}
        >
          {inner}
        </a>
      );
    }

    return (
      <button
        {...props}
        ref={ref as Ref<HTMLButtonElement>}
        id={id}
        role={role}
        tabIndex={tabIndex}
        type={type}
        disabled={isDisabled}
        onClick={isDisabled ? undefined : onClick}
        aria-label={ariaLabel || undefined}
        aria-labelledby={ariaLabelledBy || undefined}
        aria-busy={loading || undefined}
        className={resolvedClassName}
        title={tooltip}
        style={{
          ...sizeStyle,
          ...style,
        }}
      >
        {inner}
      </button>
    );
  }
);

Button.displayName = 'Button';
