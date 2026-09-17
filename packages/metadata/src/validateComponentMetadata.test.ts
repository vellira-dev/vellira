import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateComponentMetadata } from './validateComponentMetadata';

const propertyTestOptions = { numRuns: 80, seed: 615 } as const;

const validMetadata = {
  name: 'Button',
  layer: 'primitives',
  category: 'action',
  platforms: ['react', 'react-native'],
  profile: 'base',
  status: 'stable',
  capabilities: ['disabled', 'loading'],
  dependencies: {
    packages: ['@vellira-ui/tokens'],
    components: [],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    tokens: ['button'],
    icons: [{ name: 'Search', purpose: 'search action' }],
  },
} as const;

const nonEmptyMetadataString = fc
  .string({ unit: 'binary', minLength: 1, maxLength: 48 })
  .filter((value) => value.trim().length > 0);

const metadataStringArray = fc.uniqueArray(nonEmptyMetadataString, {
  maxLength: 4,
});

const validGeneratedMetadata = fc.record({
  name: nonEmptyMetadataString,
  layer: fc.constantFrom('primitives', 'components', 'patterns'),
  category: fc.constantFrom(
    'action',
    'form',
    'navigation',
    'overlay',
    'feedback',
    'data-display',
    'layout',
    'utility'
  ),
  platforms: fc.uniqueArray(fc.constantFrom('react', 'react-native'), {
    minLength: 1,
    maxLength: 2,
  }),
  profile: fc.constantFrom('base', 'form-control', 'compound', 'overlay'),
  status: fc.constantFrom('experimental', 'beta', 'stable', 'deprecated'),
  capabilities: fc.option(
    fc.uniqueArray(
      fc.constantFrom(
        'controlled',
        'uncontrolled',
        'disabled',
        'required',
        'invalid',
        'loading',
        'keyboard',
        'focus-management',
        'compound-api',
        'portal',
        'responsive'
      ),
      { maxLength: 4 }
    ),
    { nil: undefined }
  ),
  dependencies: fc.option(
    fc.record({
      packages: fc.option(metadataStringArray, { nil: undefined }),
      components: fc.option(metadataStringArray, { nil: undefined }),
    }),
    { nil: undefined }
  ),
  requirements: fc.record({
    tests: fc.boolean(),
    storybook: fc.boolean(),
    docs: fc.boolean(),
    accessibility: fc.boolean(),
    tokens: fc.option(metadataStringArray, { nil: undefined }),
  }),
});

describe('validateComponentMetadata', () => {
  it('accepts valid component metadata', () => {
    const result = validateComponentMetadata(validMetadata);

    expect(result.valid).toBe(true);

    if (result.valid) {
      expect(result.value.name).toBe('Button');
    }
  });

  it('accepts platform-scoped generator capability evidence', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      platformCapabilities: {
        react: ['keyboard'],
        'react-native': ['focus-management'],
      },
    });

    expect(result.valid).toBe(true);
  });

  it('accepts shared and platform-scoped semantic capability evidence', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      semanticCapabilities: ['image-source', 'fallback'],
      platformSemanticCapabilities: {
        react: ['size-variants'],
        'react-native': ['accessible-name'],
      },
    });

    expect(result.valid).toBe(true);
  });

  it('rejects malformed, undeclared, or duplicate platform capability evidence', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      platforms: ['react'],
      platformCapabilities: {
        react: ['disabled'],
        'react-native': ['focus-management'],
        web: ['keyboard'],
      },
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain(
        'platformCapabilities.react must not repeat shared capabilities: disabled.'
      );
      expect(result.errors).toContain(
        'platformCapabilities.react-native must refer to a declared component platform.'
      );
      expect(result.errors).toContain(
        'platformCapabilities contains unsupported platform: web.'
      );
    }
  });

  it('rejects malformed, undeclared, or duplicate semantic capability evidence', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      platforms: ['react'],
      semanticCapabilities: ['fallback'],
      platformSemanticCapabilities: {
        react: ['fallback', 'not-real'],
        'react-native': ['accessible-name'],
      },
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain(
        'platformSemanticCapabilities.react contains unsupported values: not-real.'
      );
      expect(result.errors).toContain(
        'platformSemanticCapabilities.react must not repeat shared capabilities: fallback.'
      );
      expect(result.errors).toContain(
        'platformSemanticCapabilities.react-native must refer to a declared component platform.'
      );
    }
  });

  it('rejects non-object input', () => {
    expect(validateComponentMetadata(null)).toEqual({
      valid: false,
      errors: ['Component metadata must be an object.'],
    });
  });

  it('rejects missing required fields', () => {
    const result = validateComponentMetadata({});

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain('name must be a non-empty string.');
      expect(result.errors).toContain('requirements must be an object.');
    }
  });

  it('rejects unsupported enum values', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      category: 'unknown',
      platforms: ['web'],
      status: 'ready',
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain(
        'category must be one of: action, form, navigation, overlay, feedback, data-display, layout, utility.'
      );
      expect(result.errors).toContain(
        'platforms contains unsupported values: web.'
      );
      expect(result.errors).toContain(
        'status must be one of: experimental, beta, stable, deprecated.'
      );
    }
  });

  it('rejects duplicate metadata entries', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      platforms: ['react', 'react'],
      capabilities: ['disabled', 'disabled'],
      requirements: {
        ...validMetadata.requirements,
        tokens: ['button', 'button'],
      },
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain('platforms must not contain duplicates.');
      expect(result.errors).toContain(
        'capabilities must not contain duplicates.'
      );
      expect(result.errors).toContain(
        'requirements.tokens must not contain duplicates.'
      );
    }
  });

  it('accepts machine-readable canonical icon requirements', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      requirements: {
        ...validMetadata.requirements,
        icons: [
          { name: 'ChevronDown', purpose: 'disclosure indicator' },
          { name: 'Close', purpose: 'dismiss action' },
        ],
      },
    });

    expect(result.valid).toBe(true);
  });

  it('rejects malformed and duplicate icon requirements', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      requirements: {
        ...validMetadata.requirements,
        icons: [
          { name: '', purpose: 'disclosure indicator' },
          { name: 'Close', purpose: '' },
          { name: 'Search', purpose: 'search action' },
          { name: 'Search', purpose: 'search action' },
        ],
      },
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain(
        'requirements.icons[0].name must be a non-empty string.'
      );
      expect(result.errors).toContain(
        'requirements.icons[1].purpose must be a non-empty string.'
      );
      expect(result.errors).toContain(
        'requirements.icons must not contain duplicate name/purpose requirements: Search / search action.'
      );
    }
  });

  it('rejects invalid requirement types', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      requirements: {
        tests: 'yes',
        storybook: true,
        docs: true,
        accessibility: true,
      },
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain('requirements.tests must be a boolean.');
    }
  });

  it('rejects unsupported component profile', () => {
    const result = validateComponentMetadata({
      ...validMetadata,
      profile: 'unknown',
    });

    expect(result.valid).toBe(false);

    if (!result.valid) {
      expect(result.errors).toContain(
        'profile must be one of: base, form-control, compound, overlay.'
      );
    }
  });

  it('rejects arbitrary malformed strings without crashing or drifting', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 256 }), (input) => {
        const first = validateComponentMetadata(input);
        const second = validateComponentMetadata(input);

        expect(first).toEqual({
          valid: false,
          errors: ['Component metadata must be an object.'],
        });
        expect(second).toEqual(first);
      }),
      propertyTestOptions
    );
  });

  it('handles arbitrary JSON-like input deterministically', () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 3 }), (input) => {
        const first = validateComponentMetadata(input);
        const second = validateComponentMetadata(input);

        expect(second).toEqual(first);

        if (!first.valid) {
          expect(first.errors.length).toBeGreaterThan(0);
          expect(first.errors.every((error) => error.length > 0)).toBe(true);
        }
      }),
      propertyTestOptions
    );
  });

  it('accepts generated valid metadata after JSON serialization', () => {
    fc.assert(
      fc.property(validGeneratedMetadata, (metadata) => {
        const serializedMetadata = JSON.parse(JSON.stringify(metadata));
        const result = validateComponentMetadata(serializedMetadata);

        expect(result.valid).toBe(true);

        if (result.valid) {
          expect(result.value).toEqual(serializedMetadata);
        }
      }),
      propertyTestOptions
    );
  });
});
