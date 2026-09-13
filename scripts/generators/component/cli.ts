import {
  componentCapabilities,
  type ComponentAssetRequirement,
  type ComponentCapability,
  type ComponentDependencies,
  type ComponentIconRequirement,
  type ComponentTokenContract,
} from '@vellira-ui/metadata';

export type ComponentPlatformArg = 'web' | 'native' | 'both';

export type ComponentLayerArg = 'primitives' | 'components' | 'patterns';

export type ComponentCategoryArg =
  | 'action'
  | 'form'
  | 'navigation'
  | 'overlay'
  | 'feedback'
  | 'data-display'
  | 'layout'
  | 'utility';

export type ComponentProfileArg =
  'base' | 'form-control' | 'compound' | 'overlay';

export type FormControlKindArg = 'value' | 'boolean' | 'text';

export type ComponentGeneratorOptions = {
  componentName: string;
  platform: ComponentPlatformArg;
  layer: ComponentLayerArg;
  category: ComponentCategoryArg;
  profile: ComponentProfileArg;
  control?: FormControlKindArg;
  capabilities?: readonly ComponentCapability[];
  dependencies?: ComponentDependencies;
  icons?: readonly ComponentIconRequirement[];
  tokens?: readonly string[];
  assets?: readonly ComponentAssetRequirement[];
  componentTokens?: ComponentTokenContract | false;
  parts: readonly string[];
  force: boolean;
  dryRun?: boolean;
  check?: boolean;
};

const platforms: readonly ComponentPlatformArg[] = ['web', 'native', 'both'];

const layers: readonly ComponentLayerArg[] = [
  'primitives',
  'components',
  'patterns',
];

const categories: readonly ComponentCategoryArg[] = [
  'action',
  'form',
  'navigation',
  'overlay',
  'feedback',
  'data-display',
  'layout',
  'utility',
];

const componentNamePattern = /^[A-Z][A-Za-z0-9]*$/;
const iconNamePattern = /^[A-Z][A-Za-z0-9]*$/;

export const componentGeneratorUsage =
  'Usage: pnpm create:component <Name> web|native|both primitives|components|patterns action|form|navigation|overlay|feedback|data-display|layout|utility [--profile=base|form-control|compound|overlay] [--control=value|boolean|text] [--capabilities=controlled,keyboard,...] [--parts=Root,Trigger,Content] [--icon=<IconName>:<semantic purpose>] [--token=<token.path>] [--component-tokens=standard|boolean-control|disclosure|none] [--force] [--dry-run] [--check]';

function parseIconRequirement(value: string): ComponentIconRequirement {
  const separator = value.indexOf(':');

  if (separator === -1) {
    throw new Error(
      '--icon must use the form <CanonicalIconName>:<semantic purpose>.'
    );
  }

  const name = value.slice(0, separator).trim();
  const purpose = value.slice(separator + 1).trim();

  if (!name) {
    throw new Error('--icon requires a non-empty canonical icon name.');
  }

  if (!iconNamePattern.test(name)) {
    throw new Error(
      '--icon canonical icon name must be PascalCase and contain only letters and numbers.'
    );
  }

  if (!purpose) {
    throw new Error('--icon requires a non-empty semantic purpose.');
  }

  return {
    name,
    purpose,
  };
}

export function parseComponentGeneratorArgs(
  args: readonly string[]
): ComponentGeneratorOptions {
  const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
  const flags = args.filter((arg) => arg.startsWith('--'));

  let profile: ComponentProfileArg = 'base';
  let control: FormControlKindArg = 'value';
  let explicitCapabilities: ComponentCapability[] = [];
  let force = false;
  let dryRun = false;
  let check = false;
  let parts: string[] = [];
  let componentTokens: ComponentTokenContract | false | undefined;
  const icons: ComponentIconRequirement[] = [];
  const tokens: string[] = [];

  const [componentName, platformArg, layerArg, categoryArg, ...extraArgs] =
    positionalArgs;

  for (const flag of flags) {
    if (flag === '--force') {
      force = true;
      continue;
    }

    if (flag === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (flag === '--check') {
      check = true;
      continue;
    }

    if (flag.startsWith('--profile=')) {
      const value = flag.slice('--profile='.length);

      if (
        value !== 'base' &&
        value !== 'form-control' &&
        value !== 'compound' &&
        value !== 'overlay'
      ) {
        throw new Error(
          `Invalid component profile "${value}". Expected base, form-control, compound, or overlay.`
        );
      }

      profile = value;
      continue;
    }

    if (flag.startsWith('--control=')) {
      const value = flag.slice('--control='.length);

      if (value !== 'value' && value !== 'boolean' && value !== 'text') {
        throw new Error(
          `Invalid form-control kind "${value}". Expected value, boolean, or text.`
        );
      }

      control = value;
      continue;
    }

    if (flag.startsWith('--component-tokens=')) {
      const value = flag.slice('--component-tokens='.length);

      if (value === 'none') {
        componentTokens = false;
        continue;
      }

      if (
        value !== 'standard' &&
        value !== 'boolean-control' &&
        value !== 'disclosure'
      ) {
        throw new Error(
          `Invalid component token contract "${value}". Expected standard, boolean-control, disclosure, or none.`
        );
      }

      componentTokens = value;
      continue;
    }

    if (flag.startsWith('--capabilities=')) {
      const value = flag.slice('--capabilities='.length);

      if (!value.trim()) {
        throw new Error(
          '--capabilities must contain at least one component capability.'
        );
      }

      const parsed = value
        .split(',')
        .map((capability) => capability.trim())
        .filter(Boolean);

      const invalid = parsed.filter(
        (capability) =>
          !componentCapabilities.includes(capability as ComponentCapability)
      );

      if (invalid.length > 0) {
        throw new Error(
          `Invalid component capabilities: ${invalid.join(', ')}. Expected: ${componentCapabilities.join(', ')}.`
        );
      }

      if (new Set(parsed).size !== parsed.length) {
        throw new Error('Component capabilities must not contain duplicates.');
      }

      explicitCapabilities = parsed as ComponentCapability[];
      continue;
    }

    if (flag.startsWith('--parts=')) {
      const value = flag.slice('--parts='.length);

      if (!value.trim()) {
        throw new Error('--parts must contain at least one component part.');
      }

      parts = value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.some((part) => !componentNamePattern.test(part))) {
        throw new Error(
          'Component parts must be PascalCase and contain only letters and numbers.'
        );
      }

      if (new Set(parts).size !== parts.length) {
        throw new Error('Component parts must not contain duplicates.');
      }

      continue;
    }

    if (flag.startsWith('--icon=')) {
      icons.push(parseIconRequirement(flag.slice('--icon='.length)));
      continue;
    }

    if (flag.startsWith('--token=')) {
      const token = flag.slice('--token='.length);

      if (!token) {
        throw new Error('--token requires a non-empty canonical token path.');
      }

      if (token !== token.trim()) {
        throw new Error(
          '--token canonical token path must not include surrounding whitespace.'
        );
      }

      tokens.push(token);
      continue;
    }

    throw new Error(`Unknown option: ${flag}`);
  }

  if (dryRun && check) {
    throw new Error('--dry-run and --check cannot be used together.');
  }

  if (extraArgs.length > 0) {
    throw new Error(`Unexpected arguments: ${extraArgs.join(', ')}`);
  }

  if (!componentName || !platformArg || !layerArg || !categoryArg) {
    throw new Error(componentGeneratorUsage);
  }

  if (!componentNamePattern.test(componentName)) {
    throw new Error(
      'Component name must be PascalCase and contain only letters and numbers.'
    );
  }

  if (!platforms.includes(platformArg as ComponentPlatformArg)) {
    throw new Error(
      `Invalid platform "${platformArg}". Expected: ${platforms.join(', ')}.`
    );
  }

  if (!layers.includes(layerArg as ComponentLayerArg)) {
    throw new Error(
      `Invalid layer "${layerArg}". Expected: ${layers.join(', ')}.`
    );
  }

  if (!categories.includes(categoryArg as ComponentCategoryArg)) {
    throw new Error(
      `Invalid category "${categoryArg}". Expected: ${categories.join(', ')}.`
    );
  }

  if (control !== 'value' && profile !== 'form-control') {
    throw new Error('--control is only supported by the form-control profile.');
  }

  const iconKeys = icons.map((icon) => `${icon.name}\u0000${icon.purpose}`);

  if (new Set(iconKeys).size !== iconKeys.length) {
    throw new Error(
      'Icon requirements must not contain duplicate name/purpose pairs.'
    );
  }

  if (new Set(tokens).size !== tokens.length) {
    throw new Error('Token requirements must not contain duplicates.');
  }

  return {
    componentName,
    platform: platformArg as ComponentPlatformArg,
    layer: layerArg as ComponentLayerArg,
    category: categoryArg as ComponentCategoryArg,
    profile,
    control,
    capabilities: explicitCapabilities,
    icons,
    tokens,
    ...(componentTokens !== undefined ? { componentTokens } : {}),
    parts,
    force,
    dryRun,
    check,
  };
}
