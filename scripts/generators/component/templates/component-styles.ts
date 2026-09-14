import type { ComponentProfileArg, FormControlKindArg } from '../cli';
import type { ComponentTemplateParams } from './component-types';

export type StylesTemplateParams = ComponentTemplateParams & {
  profile?: ComponentProfileArg;
  control?: FormControlKindArg;
};

export function renderStylesTemplate({
  componentName,
  profile = 'base',
  control = 'value',
}: StylesTemplateParams) {
  if (profile === 'form-control' && control === 'boolean') {
    const tokenPrefix = componentName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([a-zA-Z])(\d+)/g, '$1-$2')
      .toLowerCase();
    return `.root {
  position: relative;
  display: inline-flex;
  width: var(--${tokenPrefix}-geometry-track-width);
  height: var(--${tokenPrefix}-geometry-track-height);
  flex-shrink: 0;
  align-items: center;
  padding: var(--${tokenPrefix}-geometry-padding);
  border: var(--${tokenPrefix}-geometry-border-width) solid var(--${tokenPrefix}-off-track-border);
  border-radius: var(--radius-full);
  background: var(--${tokenPrefix}-off-track-bg);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.18s ease;
}

.root[data-state='checked'] {
  background: var(--${tokenPrefix}-on-default-track-bg);
  border-color: var(--${tokenPrefix}-on-default-track-border);
}

.root[data-state='checked']:hover:not(:disabled) {
  background: var(--${tokenPrefix}-on-hover-track-bg);
  border-color: var(--${tokenPrefix}-on-hover-track-border);
}

.root:active:not(:disabled) {
  transform: scale(var(--${tokenPrefix}-geometry-press-scale));
}

.root[data-state='checked']:active:not(:disabled) {
  background: var(--${tokenPrefix}-on-pressed-track-bg);
  border-color: var(--${tokenPrefix}-on-pressed-track-border);
}

.root:focus-visible {
  outline: var(--${tokenPrefix}-geometry-focus-ring-width) solid var(--${tokenPrefix}-focus-ring);
  outline-offset: var(--${tokenPrefix}-geometry-focus-ring-offset);
}

.root[aria-invalid='true'] {
  border-color: var(--${tokenPrefix}-error-border);
}

.root[aria-invalid='true']:focus-visible {
  outline-color: var(--${tokenPrefix}-error-ring);
}

.root:disabled {
  background: var(--${tokenPrefix}-disabled-track-bg);
  border-color: var(--${tokenPrefix}-disabled-track-border);
  cursor: not-allowed;
}

.thumb {
  display: block;
  width: var(--${tokenPrefix}-geometry-thumb-size);
  height: var(--${tokenPrefix}-geometry-thumb-size);
  border-radius: var(--radius-full);
  background: var(--${tokenPrefix}-off-thumb-bg);
  transform: translateX(0);
  transition:
    background-color 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.root[data-state='checked'] .thumb {
  background: var(--${tokenPrefix}-on-default-thumb-bg);
  transform: translateX(var(--${tokenPrefix}-geometry-thumb-travel));
}

.root[data-state='checked']:hover:not(:disabled) .thumb {
  background: var(--${tokenPrefix}-on-hover-thumb-bg);
}

.root[data-state='checked']:active:not(:disabled) .thumb {
  background: var(--${tokenPrefix}-on-pressed-thumb-bg);
}

.root:disabled .thumb {
  background: var(--${tokenPrefix}-disabled-thumb-bg);
}

@media (prefers-reduced-motion: reduce) {
  .root,
  .thumb {
    transition: none;
  }
}
`;
  }

  const className = `${componentName[0].toLowerCase()}${componentName.slice(1)}`;

  return `.${className} {
  display: inline-flex;
}
`;
}
