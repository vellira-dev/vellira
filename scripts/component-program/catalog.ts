import { componentMetadata } from '../../packages/metadata/src/components';
import { componentExpansionCatalog } from '../../packages/metadata/src/expansionCatalog';
import {
  componentIntentEvidenceForPlatform,
  requiredComponentIntentCapabilitiesForPlatform,
} from '../../packages/metadata/src/componentIntent';
import type { ComponentMetadata } from '../../packages/metadata/src/component';
import type { ComponentExpansionTarget } from '../../packages/metadata/src/expansion';
import { componentGrammarV1 } from './grammar';
import { canonicalProgramJson } from './compile';
import { fileURLToPath } from 'node:url';

/** A coverage audit, not an alternate catalog or authorization to generate. */
export function auditComponentGrammarCatalog(
  components: readonly ComponentMetadata[] = componentMetadata,
  targets: readonly ComponentExpansionTarget[] = componentExpansionCatalog
) {
  const identities = [
    ...new Set([
      ...components.map((item) => item.name),
      ...targets.map((item) => item.name),
    ]),
  ].sort();
  const rows = identities.map((identity) => {
    const component = components.find((item) => item.name === identity);
    const target = targets.find((item) => item.name === identity);
    const platforms = [
      ...new Set([
        ...(component?.platforms ?? []),
        ...(target?.platforms ?? []),
      ]),
    ].sort();
    const required = platforms.map((platform) => ({
      platform,
      capabilities: [
        ...new Set([
          ...(component
            ? componentIntentEvidenceForPlatform(component, platform)
            : []),
          ...(target
            ? requiredComponentIntentCapabilitiesForPlatform(
                target.intent,
                platform
              )
            : []),
        ]),
      ].sort(),
    }));
    const missing = required.flatMap((scope) =>
      scope.capabilities
        .filter(
          (capability) =>
            !componentGrammarV1.some(
              (module) =>
                module.platforms.includes(scope.platform) &&
                module.capabilities.includes(capability)
            )
        )
        .map((capability) => ({ capability, platform: scope.platform }))
    );
    const modules = componentGrammarV1.filter((module) =>
      required.some((scope) =>
        scope.capabilities.some((capability) =>
          module.capabilities.includes(capability)
        )
      )
    );
    const obligations = modules.flatMap((module) =>
      module.obligations.map((proof) => ({
        ...proof,
        id: `${module.id}:${proof.id}`,
      }))
    );
    return {
      identity,
      registered: component !== undefined,
      target: target !== undefined,
      profile: component?.profile ?? target!.profile,
      structuralCapabilities: [...(component?.capabilities ?? [])].sort(),
      requirements: required,
      anatomyRequirements: [
        ...new Set(['root', ...modules.flatMap((module) => module.roles)]),
      ].sort(),
      stateRequirements: modules.flatMap((module) =>
        module.slots.map((slot) => ({ module: module.id, ...slot }))
      ),
      policyDecisions: modules.flatMap((module) =>
        module.parameters.map((parameter) => ({
          module: module.id,
          ...parameter,
        }))
      ),
      stateOwnership:
        'Requires explicit approved bindings; a profile cannot choose the value domain or API.',
      eventRequirements: modules.flatMap((module) =>
        module.transitions.map((transition) => ({
          module: module.id,
          ...transition,
        }))
      ),
      modules: modules.map((module) => module.id).sort(),
      accessibilityObligations: obligations.filter(
        (proof) => proof.dimension === 'accessibility'
      ),
      platformDivergence: modules
        .filter(
          (module) => module.adapters.react !== module.adapters['react-native']
        )
        .map((module) => ({ module: module.id, adapters: module.adapters })),
      resources: component?.requirements ?? {
        componentTokens: target!.componentTokens,
      },
      proofAuthorities: {
        canonicalStages: [
          'completeness',
          'quality',
          'public-api',
          'tests',
          'typecheck',
          'build',
          'storybook',
          'docs',
          'website',
          'tooling',
          'visual',
          'smoke',
        ],
        obligations,
      },
      missingGrammarCapabilities: missing,
      disposition: missing.length
        ? 'missing-grammar-capability'
        : 'expressible-requires-approved-decisions',
      // Coverage of declared vocabulary is deliberately not full legacy API proof.
      completeProgram: false,
    };
  });
  return {
    schemaVersion: '1',
    componentCount: components.length,
    targetCount: targets.length,
    distinctCount: rows.length,
    capabilityExpressibleCount: rows.filter(
      (row) => !row.missingGrammarCapabilities.length
    ).length,
    completeProgramCount: 0,
    rows,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  process.stdout.write(
    canonicalProgramJson(auditComponentGrammarCatalog()) + '\n'
  );
