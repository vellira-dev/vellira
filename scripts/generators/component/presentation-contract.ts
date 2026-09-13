import fs from 'node:fs';
import path from 'node:path';

import {
  deriveComponentPresentationScenarios,
  getComponentPresentationScenarioTitle,
  type ComponentPresentationScenario,
} from '../component-presentation';
import { getComponentDocsTargets, resolvePlanCapabilities } from './docs';
import type { ComponentGenerationPlan } from './plan';
import { getEffectiveWebsitePresentationScenarios } from './website-presentation';

const storyAliases: Record<ComponentPresentationScenario, readonly string[]> = {
  basic: ['Basic', 'Default'],
  multiple: ['Multiple'],
  controlled: ['Controlled', 'ControlledStory'],
  uncontrolled: ['Uncontrolled', 'UncontrolledDefaultValue'],
  collapsible: ['Collapsible'],
  disabled: ['Disabled'],
  required: ['Required'],
  invalid: ['Invalid', 'Error'],
  loading: ['Loading'],
  'rich-content': ['RichContent'],
};

const websiteTitleAliases: Record<
  ComponentPresentationScenario,
  readonly string[]
> = {
  basic: ['Basic'],
  multiple: ['Multiple'],
  controlled: ['Controlled'],
  uncontrolled: ['Uncontrolled', 'Default expanded', 'Default value'],
  collapsible: ['Collapsible'],
  disabled: ['Disabled'],
  required: ['Required'],
  invalid: ['Invalid', 'Error'],
  loading: ['Loading'],
  'rich-content': ['Rich content', 'Long content'],
};

const placeholderPatterns = [
  /Describe when to use/i,
  /Replace this section/i,
  /Add the main supported states/i,
  /Document important behavior/i,
  /TODO:\s*(?:Write|Summarize)/i,
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function storyHasScenario(
  source: string,
  scenario: ComponentPresentationScenario
) {
  return storyAliases[scenario].some((alias) =>
    new RegExp(`export const ${escapeRegExp(alias)}\\b`).test(source)
  );
}

function countWebsiteScenarioEvidence(
  source: string,
  scenario: ComponentPresentationScenario
) {
  return websiteTitleAliases[scenario].reduce((count, alias) => {
    const matches = source.match(
      new RegExp(
        `title:\\s*['\"][^'\"]*${escapeRegExp(alias)}[^'\"]*['\"]`,
        'gi'
      )
    );

    return count + (matches?.length ?? 0);
  }, 0);
}

function containsPlaceholderCopy(source: string) {
  return placeholderPatterns.some((pattern) => pattern.test(source));
}

export function checkComponentPresentationContract(
  plan: ComponentGenerationPlan
): string[] {
  const driftedFiles: string[] = [];
  const capabilities = resolvePlanCapabilities(plan);
  const storyScenarios = deriveComponentPresentationScenarios({
    profile: plan.profile,
    capabilities,
  });
  const websiteScenarios = getEffectiveWebsitePresentationScenarios({
    root: plan.root,
    componentName: plan.componentName,
    profile: plan.profile,
    capabilities,
  }).map(({ scenario }) => scenario);

  for (const target of plan.targets) {
    const storyFile = path.join(
      target.componentDir,
      `${plan.componentName}.stories.tsx`
    );

    if (!fs.existsSync(storyFile)) {
      continue;
    }

    const source = fs.readFileSync(storyFile, 'utf8');

    if (
      containsPlaceholderCopy(source) ||
      storyScenarios.some((scenario) => !storyHasScenario(source, scenario))
    ) {
      driftedFiles.push(storyFile);
    }
  }

  const examplesFile = path.join(
    plan.root,
    'apps',
    'website',
    'src',
    'component-catalog',
    'components',
    plan.componentName,
    `${plan.componentName}Examples.tsx`
  );

  if (fs.existsSync(examplesFile)) {
    const source = fs.readFileSync(examplesFile, 'utf8');
    const requiredPlatformEvidence = plan.targets.length;

    if (
      websiteScenarios.some(
        (scenario) =>
          countWebsiteScenarioEvidence(source, scenario) <
          requiredPlatformEvidence
      )
    ) {
      driftedFiles.push(examplesFile);
    }
  }

  for (const docsFile of [
    plan.docsContractFile,
    ...getComponentDocsTargets(plan).map((target) => target.docsFile),
  ]) {
    if (
      fs.existsSync(docsFile) &&
      containsPlaceholderCopy(fs.readFileSync(docsFile, 'utf8'))
    ) {
      driftedFiles.push(docsFile);
    }
  }

  return [...new Set(driftedFiles)].sort();
}

export function getComponentPresentationScenarios(
  plan: ComponentGenerationPlan
) {
  return deriveComponentPresentationScenarios({
    profile: plan.profile,
    capabilities: resolvePlanCapabilities(plan),
  }).map((scenario) => ({
    id: scenario,
    title: getComponentPresentationScenarioTitle(scenario),
  }));
}
