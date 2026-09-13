import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import { checkComponentPresentationContract } from './presentation-contract';

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function createRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-presentation-contract-')
  );
  tempRoots.push(root);
  return root;
}

function createPlan(root: string) {
  return createComponentGenerationPlan({
    root,
    options: {
      componentName: 'Accordion',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      control: 'value',
      capabilities: [
        'multiple',
        'controlled',
        'uncontrolled',
        'collapsible',
        'disabled',
      ],
      parts: ['Root', 'Item', 'Trigger', 'Content'],
      force: false,
    },
  });
}

function writeCompletePresentation(root: string) {
  const plan = createPlan(root);
  const story = `export const Default = {};
export const Multiple = {};
export const Controlled = {};
export const UncontrolledDefaultValue = {};
export const Collapsible = {};
export const Disabled = {};
export const RichContent = {};
`;

  for (const target of plan.targets) {
    fs.mkdirSync(target.componentDir, { recursive: true });
    fs.writeFileSync(
      path.join(target.componentDir, 'Accordion.stories.tsx'),
      story
    );
  }

  const examplesFile = path.join(
    root,
    'apps/website/src/component-catalog/components/Accordion/AccordionExamples.tsx'
  );
  fs.mkdirSync(path.dirname(examplesFile), { recursive: true });
  const websiteTitles = [
    'Basic',
    'Multiple open items',
    'Controlled state',
    'Default expanded state',
    'Collapsible single item',
    'Disabled state',
    'Rich content',
  ];
  fs.writeFileSync(
    examplesFile,
    [...websiteTitles, ...websiteTitles]
      .map((title) => `title: '${title}'`)
      .join('\n')
  );

  fs.mkdirSync(path.dirname(plan.docsContractFile), { recursive: true });
  fs.writeFileSync(plan.docsContractFile, 'Production documentation contract.\n');

  return { plan, examplesFile };
}

describe('component presentation contract', () => {
  it('accepts comparable Web and Native capability coverage', () => {
    const { plan } = writeCompletePresentation(createRoot());

    expect(checkComponentPresentationContract(plan)).toEqual([]);
  });

  it('rejects platform divergence when a required story scenario disappears', () => {
    const { plan } = writeCompletePresentation(createRoot());
    const nativeStory = path.join(
      plan.targets.find((target) => target.isNative)!.componentDir,
      'Accordion.stories.tsx'
    );
    fs.writeFileSync(
      nativeStory,
      fs.readFileSync(nativeStory, 'utf8').replace(
        'export const Controlled = {};\n',
        ''
      )
    );

    expect(checkComponentPresentationContract(plan)).toEqual([nativeStory]);
  });

  it('rejects missing website scenario coverage', () => {
    const { plan, examplesFile } = writeCompletePresentation(createRoot());
    fs.writeFileSync(examplesFile, "title: 'Basic'\ntitle: 'Basic'\n");

    expect(checkComponentPresentationContract(plan)).toEqual([examplesFile]);
  });

  it('rejects placeholder reader-facing Storybook copy', () => {
    const { plan } = writeCompletePresentation(createRoot());
    const webStory = path.join(
      plan.targets.find((target) => !target.isNative)!.componentDir,
      'Accordion.stories.tsx'
    );
    fs.appendFileSync(
      webStory,
      'Describe when to use Accordion and what problem it solves.\n'
    );

    expect(checkComponentPresentationContract(plan)).toEqual([webStory]);
  });
});
