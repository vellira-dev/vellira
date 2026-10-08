import {
  getJsxAttributeNames,
  type ComponentPageMetadata,
} from '../metadata/metadata';
import type { ExtractedProp, Platform } from '../model/types';

/** Materialize configured scalar defaults that TypeScript still requires callers to pass. */
export function withRequiredMetadataDefaults(params: {
  componentConfig: ComponentPageMetadata;
  platform: Platform;
  apiProps: readonly ExtractedProp[];
  fragments: readonly string[];
  children?: string;
}) {
  const { error, names } = getJsxAttributeNames(params.fragments.join('\n'));
  if (error) throw new Error(`Required preview props ${error}.`);
  const supplied = new Set(names);
  if (params.children?.trim()) supplied.add('children');
  const defaults = {
    ...params.componentConfig.defaults?.shared,
    ...(params.platform === 'react'
      ? params.componentConfig.defaults?.react
      : params.componentConfig.defaults?.native),
  };
  const additions: string[] = [];
  for (const prop of params.apiProps) {
    if (!prop.required || supplied.has(prop.name)) continue;
    const value = defaults[prop.name];
    // Missing or complex defaults require an explicit metadata decision. Never
    // invent sample values, callbacks, or JSX; consumer typechecking remains required.
    if (value === undefined || prop.kind === 'other') continue;
    const valid =
      prop.kind === 'select'
        ? typeof value === 'string' && prop.options.includes(value)
        : typeof value === prop.kind &&
          (typeof value !== 'number' || Number.isFinite(value));
    if (!valid) {
      throw new Error(
        `Configured default for required ${params.platform} preview prop "${prop.name}" does not match its API.`
      );
    }
    additions.push(`${prop.name}={${JSON.stringify(value)}}`);
    supplied.add(prop.name);
  }
  return [...additions, ...params.fragments];
}

export function resolveCatalogPreviewProps(params: {
  componentConfig: ComponentPageMetadata;
  reactApiProps: readonly ExtractedProp[];
}): ComponentPageMetadata['catalogPreview'] {
  const preview = params.componentConfig.catalogPreview;
  if (!preview) return preview;
  const props = withRequiredMetadataDefaults({
    componentConfig: params.componentConfig,
    platform: 'react',
    apiProps: params.reactApiProps,
    fragments: preview.props ?? [],
    children: preview.children,
  });
  return props.length ? { ...preview, props } : preview;
}
