import type { ComponentExpansionTarget } from '@vellira-ui/metadata';

import {
  parseComponentProductionInput,
  type ComponentProductionInputV1,
} from './contracts';

export type ComponentProductionSeedV1 = Pick<
  ComponentProductionInputV1,
  | 'schemaVersion'
  | 'componentName'
  | 'platform'
  | 'layer'
  | 'category'
  | 'profile'
  | 'componentTokens'
>;

const KEYS = [
  'schemaVersion',
  'componentName',
  'platform',
  'layer',
  'category',
  'profile',
  'componentTokens',
] as const;

export function parseComponentProductionSeed(
  value: unknown
): ComponentProductionSeedV1 {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== KEYS.length ||
    !KEYS.every((key) => Object.hasOwn(value, key))
  ) {
    throw new Error(
      'Production seed requires exact fields including explicit componentTokens.'
    );
  }
  const intent = (value as Record<string, unknown>).componentTokens;
  if (
    intent !== false &&
    !['standard', 'boolean-control', 'disclosure'].includes(String(intent))
  ) {
    throw new Error('Production seed requires explicit valid componentTokens.');
  }
  const input = parseComponentProductionInput(value);
  return {
    schemaVersion: input.schemaVersion,
    componentName: input.componentName,
    platform: input.platform,
    layer: input.layer,
    category: input.category,
    profile: input.profile,
    componentTokens: input.componentTokens,
  };
}

export function productionSeedForTarget(
  target: ComponentExpansionTarget
): ComponentProductionSeedV1 {
  const web = target.platforms.includes('react');
  const native = target.platforms.includes('react-native');
  if (!web && !native)
    throw new Error(
      'Component expansion target must declare at least one platform.'
    );
  return parseComponentProductionSeed({
    schemaVersion: '1',
    componentName: target.name,
    platform: web && native ? 'both' : web ? 'web' : 'native',
    layer: target.layer,
    category: target.category,
    profile: target.profile,
    componentTokens: target.componentTokens,
  });
}
