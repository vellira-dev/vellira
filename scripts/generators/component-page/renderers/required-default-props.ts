import { toTsString } from '../helpers/format';
import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp, Platform } from '../model/types';

function getPlatformDefaults(
  componentConfig: ComponentPageMetadata,
  platform: Platform
) {
  return {
    ...(componentConfig.defaults?.shared ?? {}),
    ...(platform === 'react'
      ? (componentConfig.defaults?.react ?? {})
      : (componentConfig.defaults?.native ?? {})),
  };
}

function renderDefaultProp(name: string, value: string | boolean | number) {
  if (typeof value === 'string') {
    return `${name}=${toTsString(value)}`;
  }

  return `${name}={${String(value)}}`;
}

export function buildRequiredDefaultProps(params: {
  componentConfig: ComponentPageMetadata;
  apiProps: readonly ExtractedProp[];
  platform: Platform;
}) {
  const defaults = getPlatformDefaults(params.componentConfig, params.platform);

  return params.apiProps.flatMap((prop) => {
    if (!prop.required || !Object.hasOwn(defaults, prop.name)) {
      return [];
    }

    return [renderDefaultProp(prop.name, defaults[prop.name]!)];
  });
}

function propBindingName(fragment: string) {
  return /^([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|$)/.exec(fragment.trim())?.[1] ?? null;
}

export function mergeRequiredDefaultProps(
  requiredDefaults: readonly string[],
  explicitProps: readonly string[]
) {
  const explicitNames = new Set(
    explicitProps.map(propBindingName).filter((name): name is string => Boolean(name))
  );

  return [
    ...requiredDefaults.filter((fragment) => {
      const name = propBindingName(fragment);
      return name !== null && !explicitNames.has(name);
    }),
    ...explicitProps,
  ];
}

export function withRequiredCatalogPreviewDefaults(
  catalogPreview: ComponentPageMetadata['catalogPreview'],
  requiredDefaults: readonly string[]
): ComponentPageMetadata['catalogPreview'] {
  if (!catalogPreview) {
    return catalogPreview;
  }

  return {
    ...catalogPreview,
    props: mergeRequiredDefaultProps(requiredDefaults, catalogPreview.props ?? []),
  };
}
