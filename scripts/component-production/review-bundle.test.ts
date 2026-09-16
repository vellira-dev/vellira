import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ComponentProductionInputV1,
  ComponentProductionStageResult,
} from './contracts';
import { runComponentReviewBundle } from './review-bundle';

const roots: string[] = [];
const revision = 'a'.repeat(40);

const WEB_INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Avatar',
  platform: 'web',
  layer: 'primitives',
  category: 'data-display',
  profile: 'base',
  capabilities: [],
  componentTokens: 'standard',
  parts: [],
};

const ACCORDION_INPUT: ComponentProductionInputV1 = {
  schemaVersion: '1',
  componentName: 'Accordion',
  platform: 'both',
  layer: 'components',
  category: 'navigation',
  profile: 'compound',
  capabilities: [
    'compound-api',
    'multiple',
    'controlled',
    'uncontrolled',
    'collapsible',
    'disabled',
    'keyboard',
  ],
  componentTokens: 'disclosure',
  parts: ['Root', 'Item', 'Trigger', 'Content'],
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('component review bundle', () => {
  it('requires the canonical slug-based API artifact for multiword components', () => {
    const root = createCompleteWebFixture();
    const directory = path.join(
      root,
      'apps/website/src/component-catalog/components/ExampleBox'
    );
    fs.mkdirSync(directory);
    for (const file of [
      'index.ts',
      'ExampleBoxExamples.tsx',
      'ExampleBoxPlayground.tsx',
      'ExampleBoxAccessibility.tsx',
      'ExampleBoxDemo.tsx',
      'example-boxApi.ts',
    ]) {
      fs.writeFileSync(path.join(directory, file), 'artifact');
    }
    const evaluate = () =>
      runComponentReviewBundle({
        root,
        input: { ...WEB_INPUT, componentName: 'ExampleBox' },
        completenessStage: passedCompletenessStage(),
        dependencies: {
          resolveRevision: () => revision,
          isWorkingTreeClean: () => true,
        },
      }).report.surfaces.find(
        (surface) => surface.id === 'website-component-page'
      );

    expect(evaluate()).toMatchObject({ status: 'ready', missingArtifacts: [] });
    fs.renameSync(
      path.join(directory, 'example-boxApi.ts'),
      path.join(directory, 'exampleBoxApi.ts')
    );
    expect(evaluate()).toMatchObject({
      status: 'missing',
      missingArtifacts: [
        'apps/website/src/component-catalog/components/ExampleBox/example-boxApi.ts',
      ],
    });
  });

  it.each(['RadioGroup', 'FormField'])(
    'accepts the maintained %s website artifacts',
    (componentName) => {
      const result = runComponentReviewBundle({
        root: process.cwd(),
        input: { ...WEB_INPUT, componentName, platform: 'both' },
        completenessStage: passedCompletenessStage(),
        dependencies: {
          resolveRevision: () => revision,
          isWorkingTreeClean: () => true,
        },
      });
      expect(
        result.report.surfaces.find(
          (surface) => surface.id === 'website-component-page'
        )
      ).toMatchObject({ status: 'ready', missingArtifacts: [] });
    }
  );

  it('marks one complete candidate revision ready for human review', () => {
    const root = createCompleteWebFixture();
    const result = runComponentReviewBundle({
      root,
      input: WEB_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => revision,
        isWorkingTreeClean: () => true,
      },
    });

    expect(result.report).toMatchObject({
      schemaVersion: '1',
      componentName: 'Avatar',
      revision,
      workingTreeClean: true,
      status: 'ready',
      readyForHumanReview: true,
      blockingFindings: [],
    });
    expect(result.completenessStage.status).toBe('passed');
    expect(
      result.report.surfaces.find(
        (surface) => surface.id === 'native-playground'
      )
    ).toMatchObject({
      required: false,
      status: 'not-applicable',
    });
  });

  it('accepts canonical metadata-free website generation', () => {
    const root = createCompleteWebFixture();
    const websiteMetadata = path.join(
      root,
      'apps/website/src/component-catalog/components/Avatar/metadata.ts'
    );

    expect(fs.existsSync(websiteMetadata)).toBe(false);

    const result = runComponentReviewBundle({
      root,
      input: WEB_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => revision,
        isWorkingTreeClean: () => true,
      },
    });

    expect(result.report.status).toBe('ready');
    expect(
      result.report.surfaces.find(
        (surface) => surface.id === 'website-component-page'
      )
    ).toMatchObject({ status: 'ready' });
  });

  it('blocks readiness when a required candidate review surface is missing', () => {
    const root = createCompleteWebFixture();
    fs.rmSync(path.join(root, 'apps/docs/src/react/avatar.md'));

    const result = runComponentReviewBundle({
      root,
      input: WEB_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => revision,
        isWorkingTreeClean: () => true,
      },
    });

    expect(result.report.status).toBe('blocked');
    expect(result.report.readyForHumanReview).toBe(false);
    expect(result.completenessStage.status).toBe('blocked');
    expect(result.report.blockingFindings).toEqual([
      expect.objectContaining({
        ruleId: 'review-bundle.required-surface',
        path: 'apps/docs/src/react/avatar.md',
      }),
    ]);
  });

  it('blocks readiness when exact candidate revision cannot be resolved', () => {
    const root = createCompleteWebFixture();
    const result = runComponentReviewBundle({
      root,
      input: WEB_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => null,
        isWorkingTreeClean: () => true,
      },
    });

    expect(result.report.revision).toBeNull();
    expect(result.report.status).toBe('blocked');
    expect(result.report.blockingFindings).toContainEqual(
      expect.objectContaining({
        ruleId: 'review-bundle.exact-revision',
      })
    );
  });

  it('blocks readiness when the working tree does not match the reported revision', () => {
    const root = createCompleteWebFixture();
    const result = runComponentReviewBundle({
      root,
      input: WEB_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => revision,
        isWorkingTreeClean: () => false,
      },
    });

    expect(result.report.revision).toBe(revision);
    expect(result.report.workingTreeClean).toBe(false);
    expect(result.report.status).toBe('blocked');
    expect(result.report.readyForHumanReview).toBe(false);
    expect(result.completenessStage.status).toBe('blocked');
    expect(result.report.blockingFindings).toContainEqual(
      expect.objectContaining({
        id: 'completeness:review-bundle:working-tree',
        ruleId: 'review-bundle.exact-revision',
      })
    );
  });

  it('keeps Accordion as the real cross-platform review-bundle regression fixture', () => {
    const result = runComponentReviewBundle({
      root: process.cwd(),
      input: ACCORDION_INPUT,
      completenessStage: passedCompletenessStage(),
      dependencies: {
        resolveRevision: () => revision,
        isWorkingTreeClean: () => true,
      },
    });

    expect(result.report.status).toBe('ready');
    expect(result.report.readyForHumanReview).toBe(true);
    expect(result.report.blockingFindings).toEqual([]);
    expect(
      result.report.surfaces.find(
        (surface) => surface.id === 'catalog-signature-preview'
      )
    ).toMatchObject({ status: 'ready' });
    expect(
      result.report.surfaces.find(
        (surface) => surface.id === 'docs-react-native'
      )
    ).toMatchObject({ status: 'ready' });
  });
});

function createCompleteWebFixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-review-bundle-')
  );
  roots.push(root);

  const files: Record<string, string> = {
    'packages/metadata/src/components/Avatar.metadata.ts': 'metadata',
    'packages/types/src/avatar.ts': 'types',
    'packages/react/src/primitives/Avatar/Avatar.tsx': 'component',
    'packages/react/src/primitives/Avatar/index.ts': 'export',
    'packages/react/src/index.ts': 'package export',
    'packages/react/src/primitives/Avatar/Avatar.test.tsx': 'test',
    'packages/react/src/primitives/Avatar/Avatar.test-contract.json': '{}',
    'packages/react/src/primitives/Avatar/Avatar.stories.tsx': 'story',
    'apps/docs/src/react/avatar.md': '# Avatar',
    'apps/website/src/component-catalog/components/Avatar/index.ts': 'index',
    'apps/website/src/component-catalog/components/Avatar/AvatarExamples.tsx':
      'examples',
    'apps/website/src/component-catalog/components/Avatar/AvatarPlayground.tsx':
      'playground',
    'apps/website/src/component-catalog/components/Avatar/AvatarAccessibility.tsx':
      'accessibility',
    'apps/website/src/component-catalog/components/Avatar/avatarApi.ts': 'api',
    'apps/website/src/component-catalog/components/Avatar/AvatarDemo.tsx':
      'demo',
    'apps/website/src/component-catalog/components/Avatar/AvatarCatalogPreview.tsx':
      'preview',
    'apps/website/src/component-catalog/registry/componentPresentation.ts':
      "{ slug: 'avatar', name: 'Avatar' }",
    'apps/website/src/component-catalog/registry/componentPages.ts':
      "avatar: { name: 'Avatar' }",
  };

  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  return root;
}

function passedCompletenessStage(): ComponentProductionStageResult {
  return {
    id: 'completeness',
    status: 'passed',
    summary: 'Canonical completeness passed.',
    findings: [],
    artifacts: [],
  };
}
