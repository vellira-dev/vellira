import {
  renderCompoundComponentTemplate,
  renderCompoundTypesTemplate,
  renderFormControlComponentTemplate,
  renderFormControlTypesTemplate,
  renderNativeComponentTemplate,
  renderSharedRendererTypesTemplate,
  renderTypesTemplate,
  renderWebComponentTemplate,
  renderNativeOverlayComponentTemplate,
  renderNativeOverlayTypesTemplate,
  renderWebOverlayComponentTemplate,
  renderWebOverlayTypesTemplate,
} from './templates';

import type {
  ComponentGenerationPlan,
  ComponentGenerationTarget,
} from './plan';

export type ResolvedComponentTemplates = {
  types: string;
  component: string;
};

export function resolveComponentTemplates(params: {
  plan: ComponentGenerationPlan;
  target: ComponentGenerationTarget;
}): ResolvedComponentTemplates {
  const { plan, target } = params;
  const { componentName } = plan;

  switch (plan.profile) {
    case 'form-control':
      return {
        types: renderFormControlTypesTemplate({
          componentName,
          control: plan.control,
        }),
        component: renderFormControlComponentTemplate({
          componentName,
          isNative: target.isNative,
          control: plan.control,
        }),
      };

    case 'compound':
      return {
        types: renderCompoundTypesTemplate({
          componentName,
          parts: plan.parts,
        }),
        component: renderCompoundComponentTemplate({
          componentName,
          parts: plan.parts,
        }),
      };

    case 'overlay':
      if (plan.parts.length > 0) {
        return {
          types: target.isNative
            ? renderNativeOverlayTypesTemplate({
                componentName,
              })
            : renderWebOverlayTypesTemplate({
                componentName,
              }),

          component: renderCompoundComponentTemplate({
            componentName,
            parts: plan.parts,
          }),
        };
      }

      return target.isNative
        ? {
            types: renderNativeOverlayTypesTemplate({
              componentName,
            }),
            component: renderNativeOverlayComponentTemplate({
              componentName,
            }),
          }
        : {
            types: renderWebOverlayTypesTemplate({
              componentName,
            }),
            component: renderWebOverlayComponentTemplate({
              componentName,
            }),
          };

    case 'base':
      return {
        types:
          plan.typeOwnership === 'shared'
            ? renderSharedRendererTypesTemplate({ componentName })
            : renderTypesTemplate({ componentName }),
        component: target.isNative
          ? renderNativeComponentTemplate({
              componentName,
            })
          : renderWebComponentTemplate({
              componentName,
            }),
      };
  }
}
