import {
  componentCapabilities,
  type ComponentCategory,
  type ComponentLayer,
  componentLifecycleStatuses,
  type ComponentMetadata,
  type ComponentPlatform,
  type ComponentStatus,
} from './component';

export type ComponentMetadataValidationResult =
  | {
      valid: true;
      errors: [];
      value: ComponentMetadata;
    }
  | {
      valid: false;
      errors: string[];
    };

const componentLayers: readonly ComponentLayer[] = [
  'primitives',
  'components',
  'patterns',
];

const componentCategories: readonly ComponentCategory[] = [
  'action',
  'form',
  'navigation',
  'overlay',
  'feedback',
  'data-display',
  'layout',
  'utility',
];

const componentPlatforms: readonly ComponentPlatform[] = [
  'react',
  'react-native',
];

const componentStatuses: readonly ComponentStatus[] =
  componentLifecycleStatuses;

const COMPONENT_PROFILES = [
  'base',
  'form-control',
  'compound',
  'overlay',
] as const;

const COMPONENT_TOKEN_CONTRACTS = [
  'standard',
  'boolean-control',
  'disclosure',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function validateStringArray(params: {
  value: unknown;
  field: string;
  errors: string[];
  allowedValues?: readonly string[];
  requireNonEmpty?: boolean;
}) {
  const {
    value,
    field,
    errors,
    allowedValues,
    requireNonEmpty = false,
  } = params;

  if (!isStringArray(value)) {
    errors.push(`${field} must be an array of strings.`);
    return;
  }

  if (requireNonEmpty && value.length === 0) {
    errors.push(`${field} must contain at least one value.`);
  }

  if (value.some((item) => item.trim().length === 0)) {
    errors.push(`${field} must not contain empty values.`);
  }

  if (hasDuplicates(value)) {
    errors.push(`${field} must not contain duplicates.`);
  }

  if (allowedValues) {
    const invalidValues = value.filter((item) => !allowedValues.includes(item));

    if (invalidValues.length > 0) {
      errors.push(
        `${field} contains unsupported values: ${invalidValues.join(', ')}.`
      );
    }
  }
}

function validateDependencySet(
  value: unknown,
  field: string,
  errors: string[]
) {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }

  if (value.packages !== undefined) {
    validateStringArray({
      value: value.packages,
      field: `${field}.packages`,
      errors,
    });
  }

  if (value.components !== undefined) {
    validateStringArray({
      value: value.components,
      field: `${field}.components`,
      errors,
    });
  }
}

function validateAssetRequirements(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push('requirements.assets must be an array.');
    return;
  }

  const seen = new Set<string>();

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`requirements.assets[${index}] must be an object.`);
      return;
    }

    const validPath = isNonEmptyString(item.path);
    const validPurpose = isNonEmptyString(item.purpose);

    if (!validPath) {
      errors.push(
        `requirements.assets[${index}].path must be a non-empty string.`
      );
    }

    if (!validPurpose) {
      errors.push(
        `requirements.assets[${index}].purpose must be a non-empty string.`
      );
    }

    if (validPath && validPurpose) {
      const key = `${item.path}\u0000${item.purpose}`;

      if (seen.has(key)) {
        errors.push(
          `requirements.assets must not contain duplicate path/purpose requirements: ${item.path} / ${item.purpose}.`
        );
      }

      seen.add(key);
    }
  });
}

function validateIconRequirements(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push('requirements.icons must be an array.');
    return;
  }

  const seen = new Set<string>();

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`requirements.icons[${index}] must be an object.`);
      return;
    }

    const validName = isNonEmptyString(item.name);
    const validPurpose = isNonEmptyString(item.purpose);

    if (!validName) {
      errors.push(
        `requirements.icons[${index}].name must be a non-empty string.`
      );
    }

    if (!validPurpose) {
      errors.push(
        `requirements.icons[${index}].purpose must be a non-empty string.`
      );
    }

    if (validName && validPurpose) {
      const key = `${item.name}\u0000${item.purpose}`;

      if (seen.has(key)) {
        errors.push(
          `requirements.icons must not contain duplicate name/purpose requirements: ${item.name} / ${item.purpose}.`
        );
      }

      seen.add(key);
    }
  });
}

export function validateComponentMetadata(
  input: unknown
): ComponentMetadataValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ['Component metadata must be an object.'],
    };
  }

  if (!isNonEmptyString(input.name)) {
    errors.push('name must be a non-empty string.');
  }

  if (
    typeof input.layer !== 'string' ||
    !componentLayers.includes(input.layer as ComponentLayer)
  ) {
    errors.push(`layer must be one of: ${componentLayers.join(', ')}.`);
  }

  if (
    typeof input.category !== 'string' ||
    !componentCategories.includes(input.category as ComponentCategory)
  ) {
    errors.push(`category must be one of: ${componentCategories.join(', ')}.`);
  }

  if (
    typeof input.profile !== 'string' ||
    !COMPONENT_PROFILES.includes(
      input.profile as (typeof COMPONENT_PROFILES)[number]
    )
  ) {
    errors.push(`profile must be one of: ${COMPONENT_PROFILES.join(', ')}.`);
  }

  validateStringArray({
    value: input.platforms,
    field: 'platforms',
    errors,
    allowedValues: componentPlatforms,
    requireNonEmpty: true,
  });

  if (
    typeof input.status !== 'string' ||
    !componentStatuses.includes(input.status as ComponentStatus)
  ) {
    errors.push(`status must be one of: ${componentStatuses.join(', ')}.`);
  }

  if (input.capabilities !== undefined) {
    validateStringArray({
      value: input.capabilities,
      field: 'capabilities',
      errors,
      allowedValues: componentCapabilities,
    });
  }

  if (input.platformCapabilities !== undefined) {
    if (!isRecord(input.platformCapabilities)) {
      errors.push('platformCapabilities must be an object.');
    } else {
      const declaredPlatforms = new Set(
        isStringArray(input.platforms) ? input.platforms : []
      );
      const sharedCapabilities = new Set(
        isStringArray(input.capabilities) ? input.capabilities : []
      );

      for (const [platform, capabilities] of Object.entries(
        input.platformCapabilities
      )) {
        if (!componentPlatforms.includes(platform as ComponentPlatform)) {
          errors.push(
            `platformCapabilities contains unsupported platform: ${platform}.`
          );
          continue;
        }

        if (!declaredPlatforms.has(platform)) {
          errors.push(
            `platformCapabilities.${platform} must refer to a declared component platform.`
          );
        }

        validateStringArray({
          value: capabilities,
          field: `platformCapabilities.${platform}`,
          errors,
          allowedValues: componentCapabilities,
        });

        if (isStringArray(capabilities)) {
          const duplicateSharedCapabilities = capabilities.filter((capability) =>
            sharedCapabilities.has(capability)
          );

          if (duplicateSharedCapabilities.length > 0) {
            errors.push(
              `platformCapabilities.${platform} must not repeat shared capabilities: ${duplicateSharedCapabilities.join(
                ', '
              )}.`
            );
          }
        }
      }
    }
  }

  if (input.dependencies !== undefined) {
    if (!isRecord(input.dependencies)) {
      errors.push('dependencies must be an object.');
    } else {
      validateDependencySet(input.dependencies, 'dependencies', errors);

      if (input.dependencies.platforms !== undefined) {
        if (!isRecord(input.dependencies.platforms)) {
          errors.push('dependencies.platforms must be an object.');
        } else {
          for (const [platform, dependencySet] of Object.entries(
            input.dependencies.platforms
          )) {
            if (!componentPlatforms.includes(platform as ComponentPlatform)) {
              errors.push(
                `dependencies.platforms contains unsupported platform: ${platform}.`
              );
              continue;
            }

            validateDependencySet(
              dependencySet,
              `dependencies.platforms.${platform}`,
              errors
            );
          }
        }
      }
    }
  }

  if (!isRecord(input.requirements)) {
    errors.push('requirements must be an object.');
  } else {
    for (const field of [
      'tests',
      'storybook',
      'docs',
      'accessibility',
    ] as const) {
      if (typeof input.requirements[field] !== 'boolean') {
        errors.push(`requirements.${field} must be a boolean.`);
      }
    }

    if (input.requirements.componentTokens !== undefined) {
      const value = input.requirements.componentTokens;

      if (
        value !== false &&
        (typeof value !== 'string' ||
          !COMPONENT_TOKEN_CONTRACTS.includes(
            value as (typeof COMPONENT_TOKEN_CONTRACTS)[number]
          ))
      ) {
        errors.push(
          `requirements.componentTokens must be false or one of: ${COMPONENT_TOKEN_CONTRACTS.join(', ')}.`
        );
      }
    }

    if (input.requirements.tokens !== undefined) {
      validateStringArray({
        value: input.requirements.tokens,
        field: 'requirements.tokens',
        errors,
      });
    }

    if (input.requirements.icons !== undefined) {
      validateIconRequirements(input.requirements.icons, errors);
    }

    if (input.requirements.assets !== undefined) {
      validateAssetRequirements(input.requirements.assets, errors);
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    value: input as unknown as ComponentMetadata,
  };
}
