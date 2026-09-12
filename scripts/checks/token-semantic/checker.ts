import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { assertComponentTokenLifecycleCanMaterialize } from '../../generators/component/token-lifecycle-contract';
import { checkTokenOwnership } from '../token-ownership/checker';
import type { TokenOwnershipReport } from '../token-ownership/checker';
import { runTokenSemanticAudit } from './contract';
import type { FindingInput, RuleAdapter, RuleResult } from './contract';
import { checkTokenCssReferences } from './css-repository';
import { checkTokenFactoryConventions } from './factory-convention';
import { checkTokenPlatformBoundary } from './platform-boundary';
import { checkTokenPublicApi } from './public-api';
import { checkTokenPackagePublicSurface } from './public-api-package-surface';
import { checkTokenSemanticDependencies } from './semantic-dependency';
import { checkTokenSemanticVocabulary } from './semantic-vocabulary';
import { checkComponentShadowConsumers } from './shadow-component-consumption';
import { checkTokenShadowAuthority } from './shadow-authority';
import { checkTokenStateVocabulary } from './state-vocabulary';
import { checkTokenValueKindOutputs } from './value-kind-output';
import { checkTokenValueKinds } from './value-kind-repository';
import { checkTokenVisualPreservation } from './visual-preservation';

export function checkTokenSemantics(root: string) {
  const authorityRoot = fileURLToPath(new URL('../../../', import.meta.url));
  if (fs.realpathSync(root) !== fs.realpathSync(authorityRoot)) {
    throw new Error(
      'Run the audit from the checkout that owns its authorities.'
    );
  }
  let ownership: TokenOwnershipReport | undefined;
  function ownershipRule(semantic: boolean): RuleResult {
    ownership ??= checkTokenOwnership(root);
    const ruleId = semantic
      ? 'tokens.namespace-lifecycle'
      : 'tokens.component-ownership';
    const findings: FindingInput[] = ownership.findings
      .filter((finding) => finding.code.includes('semantic') === semantic)
      .map((finding) => ({
        ruleId,
        code: finding.code,
        severity: 'error',
        sourcePath: finding.path,
        tokenPath: null,
        line: null,
        column: null,
        layer: semantic ? 'semantic' : 'component',
        theme: null,
        platform: null,
        evidence: finding.message,
        expected:
          'Canonical metadata/lifecycle and deterministic consumer evidence.',
        migrationStatus: 'untracked',
        suggestedAction:
          'Repair the canonical ownership authority or its consumers.',
      }));

    if (!semantic) {
      for (const componentName of ownership.metadataTokenFamilies) {
        try {
          assertComponentTokenLifecycleCanMaterialize(componentName, root);
        } catch (error) {
          findings.push({
            ruleId,
            code: 'component-readiness-lifecycle-drift',
            severity: 'error',
            sourcePath:
              'scripts/generators/component/token-lifecycle-contract.ts',
            tokenPath: `components.${componentName}`,
            line: null,
            column: null,
            layer: 'component',
            theme: null,
            platform: null,
            evidence: error instanceof Error ? error.message : String(error),
            expected:
              'Every metadata-required component-token family must pass the same Generator V2 lifecycle materialization guard used by production preflight.',
            migrationStatus: 'untracked',
            suggestedAction:
              'Repair canonical component metadata/lifecycle ownership before Generator V2 or component production may materialize the family.',
          });
        }
      }
    }

    return {
      coverage: 'complete',
      scope: semantic
        ? 'Canonical #886 semantic lifecycle/public/source/barrel parity, deterministic real consumer evidence, role-level source inventory, cross-theme role-shape parity, canonical Semantic Vocabulary V1 classification, and canonical derived shadow authority.'
        : 'Canonical #886 component lifecycle/public/theme-barrel parity, reverse metadata-required ownership parity, canonical owner identity, and the Generator V2 lifecycle materialization guard used by component-production preflight.',
      checked: semantic
        ? ownership.semanticNamespaces.length +
          ownership.semanticRolePaths.length
        : ownership.componentFamilies.length +
          ownership.metadataTokenFamilies.length,
      findings,
    };
  }

  function valueKindRule(): RuleResult {
    const inventory = checkTokenValueKinds();
    const outputs = checkTokenValueKindOutputs(root);

    return {
      coverage: 'complete',
      scope:
        'Complete #881 value-kind/unit contract: every maintained canonical scalar/intent leaf is classified and validated through the shared serializer; actual Web collectors are exact with generated variable registries; committed tokens.css is byte-identical to canonical generated output; and Generator V2 delegates numeric component roles to the same fail-closed authority. #880 separately proves resolved-value preservation.',
      checked: inventory.checked + outputs.checked,
      findings: [...inventory.findings, ...outputs.findings],
    };
  }

  function shadowAuthorityRule(): RuleResult {
    const authority = checkTokenShadowAuthority(root);
    const consumers = checkComponentShadowConsumers();

    return {
      coverage: 'complete',
      scope:
        'Complete #885 unified shadow authority: canonical structured effects, Web semantic/focus derivation, React Native approximation resolution, required Tooltip/Popover/Modal/Dropdown/Select canonical shadow intents, repository-wide component shadow-key/renderer-field inspection, and known compatibility/output bypasses. Renderer-neutral adaptation and resolved value preservation remain separately enforced by complete tokens.platform-boundary (#884) and tokens.visual-preservation (#880), matching #885 acceptance without duplicating those rules.',
      checked: authority.checked + consumers.checked,
      findings: [...authority.findings, ...consumers.findings],
    };
  }

  function publicApiRule(): RuleResult {
    const authority = checkTokenPublicApi(root);
    const packageSurface = checkTokenPackagePublicSurface(root);

    return {
      coverage: 'complete',
      scope:
        'Complete #889 public API/deprecation authority: explicit theme identities, generated CSS selectors/runtime-path compatibility, bounded legacy exports and CSS aliases, exact package main/types/export-subpath inventory, and automatic semver removal-boundary enforcement.',
      checked: authority.checked + packageSurface.checked,
      findings: [...authority.findings, ...packageSurface.findings],
    };
  }

  const adapters: RuleAdapter[] = [
    { ruleId: 'tokens.value-kind', run: valueKindRule },
    {
      ruleId: 'tokens.state-vocabulary',
      run: () => checkTokenStateVocabulary(root),
    },
    {
      ruleId: 'tokens.semantic-vocabulary',
      run: checkTokenSemanticVocabulary,
    },
    {
      ruleId: 'tokens.factory-convention',
      run: () => checkTokenFactoryConventions(root),
    },
    { ruleId: 'tokens.platform-boundary', run: checkTokenPlatformBoundary },
    {
      ruleId: 'tokens.public-api',
      run: publicApiRule,
    },
    {
      ruleId: 'tokens.semantic-dependency',
      run: () => checkTokenSemanticDependencies(root),
    },
    {
      ruleId: 'tokens.shadow-authority',
      run: shadowAuthorityRule,
    },
    {
      ruleId: 'tokens.visual-preservation',
      run: () => checkTokenVisualPreservation(root),
    },
    { ruleId: 'tokens.component-ownership', run: () => ownershipRule(false) },
    { ruleId: 'tokens.namespace-lifecycle', run: () => ownershipRule(true) },
    {
      ruleId: 'tokens.consumer-reference',
      run: () => checkTokenCssReferences(root),
    },
  ];
  return runTokenSemanticAudit(adapters);
}
