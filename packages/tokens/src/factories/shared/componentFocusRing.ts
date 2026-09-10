import { createComponentFocusRingShadowIntent } from '../../platform-output/component-token-intents.js';

export type SemanticFocusRing = {
  readonly color: string;
  readonly width: string;
  readonly offsetColor: string;
};

export const createComponentFocusRing = (ring: SemanticFocusRing) =>
  ({
    color: ring.color,
    width: ring.width,
    shadow: createComponentFocusRingShadowIntent(),
    offset: ring.offsetColor,
  }) as const;
