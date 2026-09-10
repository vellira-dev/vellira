import type { BaseButtonProps, ButtonAppearance } from '@vellira-ui/types';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

export interface ButtonProps
  extends
    Omit<BaseButtonProps, 'appearance'>,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    Pick<
      AnchorHTMLAttributes<HTMLAnchorElement>,
      'href' | 'target' | 'rel' | 'download'
    > {
  /** Visible button content. */
  children?: ReactNode;
  /** Visual appearance. `bare` preserves Button behavior while composition owns chrome and geometry. */
  appearance?: ButtonAppearance | 'bare';
  /** Icon rendered before the button content. */
  iconStart?: ReactNode;
  /** Icon rendered after the button content. */
  iconEnd?: ReactNode;
  /** Custom loading indicator rendered while loading. */
  spinner?: ReactNode;
  /** HTML title tooltip text for the button or composed child. */
  tooltip?: string;
  /** Compact badge rendered after the label when not icon-only. */
  badge?: ReactNode;
  /** Keyboard shortcut hint rendered after the label when not icon-only. */
  shortcut?: ReactNode;
  /** Composes Button behavior and styling onto a single child element. */
  asChild?: boolean;
}
