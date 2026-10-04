import { createHash } from 'node:crypto';
import { componentIntentCapabilities } from '../../packages/metadata/src/componentIntent';
import {
  componentAnatomyRoles,
  componentProgramEvents,
  componentStateDomains,
  componentStateOwners,
  componentTransitionActions,
  type ComponentProgramCompilationV1,
  type ComponentProgramDecisionsV1,
  type ComponentProgramFindingV1,
  type ComponentProgramSourceV1,
  type ComponentProgramV1,
} from '../../packages/metadata/src/componentProgram';
import { componentQualityDimensions } from '../../packages/metadata/src/quality';
import {
  componentGrammarV1,
  componentGrammarInteractionsV1,
  type GrammarModuleV1,
} from './grammar';
import {
  enumeration,
  identifier,
  list,
  parseComponentProgramDecisions,
  platforms,
  record,
} from './parse';

export function canonicalProgramJson(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, normalize(child)])
      );
    return item;
  };
  return JSON.stringify(normalize(value));
}

export function programDigest(prefix: string, value: unknown) {
  return `${prefix}:${createHash('sha256').update(canonicalProgramJson(value)).digest('hex')}`;
}
const sorted = <T>(items: readonly T[]): T[] =>
  [...items].sort((a, b) => {
    const left = canonicalProgramJson(a);
    const right = canonicalProgramJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
const unique = <T>(items: readonly T[]): T[] =>
  sorted([
    ...new Map(
      items.map((item) => [canonicalProgramJson(item), item])
    ).values(),
  ]);
const subset = <T>(items: readonly T[], allowed: readonly T[]) =>
  items.every((item) => allowed.includes(item));
const overlaps = <T>(left: readonly T[], right: readonly T[]) =>
  left.some((item) => right.includes(item));

function graphOrder(nodes: ReadonlyMap<string, readonly string[]>): string[] {
  const done = new Set<string>();
  const active = new Set<string>();
  const order: string[] = [];
  const visit = (id: string) => {
    if (active.has(id))
      throw new Error(`Cyclic dependency: ${[...active, id].join(' -> ')}.`);
    if (done.has(id)) return;
    const dependencies = nodes.get(id);
    if (!dependencies) throw new Error(`Unknown dependency ${id}.`);
    active.add(id);
    for (const dependency of [...dependencies].sort()) visit(dependency);
    active.delete(id);
    done.add(id);
    order.push(id);
  };
  for (const id of [...nodes.keys()].sort()) visit(id);
  return order;
}

/** Check registry mutations before compiling any program, not after code generation. */
export function validateComponentGrammar(registry: readonly GrammarModuleV1[]) {
  list(registry, 64);
  const ids = new Set<string>();
  for (const module of registry) {
    record(
      module,
      [
        'id',
        'capabilities',
        'platforms',
        'requires',
        'implies',
        'conflicts',
        'roles',
        'parameters',
        'slots',
        'transitions',
        'adapters',
        'obligations',
      ],
      'grammar module'
    );
    identifier(module.id);
    if (ids.has(module.id))
      throw new Error(`Duplicate grammar module ${module.id}.`);
    ids.add(module.id);
    platforms(module.platforms);
    for (const capability of list(module.capabilities, 26))
      enumeration(capability, componentIntentCapabilities);
    for (const role of list(module.roles, 64))
      enumeration(role, componentAnatomyRoles);
    const parameterIds = new Set<string>();
    for (const parameter of list(
      module.parameters,
      16
    ) as GrammarModuleV1['parameters']) {
      identifier(parameter.id);
      if (parameterIds.has(parameter.id))
        throw new Error('Duplicate module parameter.');
      parameterIds.add(parameter.id);
      if (parameter.kind === 'choice') {
        record(parameter, ['id', 'kind', 'choices'], 'choice parameter');
        if (!parameter.choices.length)
          throw new Error('Empty parameter choice domain.');
        for (const choice of list(parameter.choices, 64)) identifier(choice);
      } else {
        record(
          parameter,
          ['id', 'kind', 'minimum', 'maximum'],
          'integer parameter'
        );
        if (
          parameter.kind !== 'integer' ||
          !Number.isSafeInteger(parameter.minimum) ||
          !Number.isSafeInteger(parameter.maximum) ||
          parameter.maximum < parameter.minimum
        )
          throw new Error('Invalid bounded parameter domain.');
      }
    }
    for (const relation of [module.requires, module.implies, module.conflicts])
      for (const id of list(relation, 64)) identifier(id);
    const slots = new Set<string>();
    for (const slot of list(module.slots, 16) as GrammarModuleV1['slots']) {
      record(
        slot,
        ['id', 'domains', 'owners', 'platforms'],
        'grammar state slot'
      );
      identifier(slot.id);
      if (slots.has(slot.id) || !slot.domains.length || !slot.owners.length)
        throw new Error('Duplicate or empty state slot.');
      slots.add(slot.id);
      for (const value of slot.domains)
        enumeration(value, componentStateDomains);
      for (const value of slot.owners) enumeration(value, componentStateOwners);
      if (!subset(platforms(slot.platforms), module.platforms))
        throw new Error('Slot scope exceeds module scope.');
    }
    for (const transition of list(
      module.transitions,
      128
    ) as GrammarModuleV1['transitions']) {
      record(
        transition,
        ['slot', 'event', 'action', 'platforms'],
        'grammar transition'
      );
      if (!slots.has(transition.slot))
        throw new Error('Transition references unknown state slot.');
      enumeration(transition.event, componentProgramEvents);
      enumeration(transition.action, componentTransitionActions);
      if (!subset(platforms(transition.platforms), module.platforms))
        throw new Error('Transition scope exceeds module scope.');
    }
    record(module.adapters, module.platforms, 'platform adapters');
    for (const platform of module.platforms)
      identifier(module.adapters[platform]);
    if (!module.obligations.length)
      throw new Error('Every module requires explicit proof obligations.');
    const proofs = new Set<string>();
    for (const proof of list(
      module.obligations,
      64
    ) as GrammarModuleV1['obligations']) {
      record(
        proof,
        ['id', 'statement', 'dimension', 'evaluation', 'ruleId', 'platforms'],
        'proof obligation'
      );
      identifier(proof.id);
      if (!subset(platforms(proof.platforms), module.platforms))
        throw new Error('Proof scope exceeds module scope.');
      if (proofs.has(proof.id)) throw new Error('Duplicate proof obligation.');
      proofs.add(proof.id);
      enumeration(proof.dimension, componentQualityDimensions);
      enumeration(proof.evaluation, ['automated', 'human-review']);
      if (
        typeof proof.statement !== 'string' ||
        !proof.statement.trim() ||
        proof.statement.length > 1000
      )
        throw new Error('Invalid proof statement.');
      if (proof.ruleId !== null) identifier(proof.ruleId);
    }
  }
  for (const module of registry)
    for (const dependency of [
      ...module.requires,
      ...module.implies,
      ...module.conflicts,
    ]) {
      if (!ids.has(dependency) || dependency === module.id)
        throw new Error(
          `Invalid module relation: ${module.id} -> ${dependency}.`
        );
    }
  return graphOrder(
    new Map(
      registry.map((module) => [
        module.id,
        [...module.requires, ...module.implies],
      ])
    )
  );
}

function normalizedSource(
  source: ComponentProgramSourceV1
): ComponentProgramSourceV1 {
  record(
    source,
    ['platforms', 'capabilities', 'parts', 'resources'],
    'program source'
  );
  platforms(source.platforms);
  list(source.capabilities, 52);
  for (const requirement of source.capabilities) {
    record(requirement, ['capability', 'platforms'], 'source capability');
    identifier(requirement.capability);
    if (!subset(platforms(requirement.platforms), source.platforms))
      throw new Error('Capability scope exceeds source platforms.');
  }
  for (const part of list(source.parts, 64)) identifier(part);
  record(
    source.resources,
    ['componentTokens', 'tokens', 'icons', 'assets'],
    'resource authority'
  );
  if (source.resources.componentTokens !== false)
    enumeration(source.resources.componentTokens, [
      'standard',
      'boolean-control',
      'disclosure',
    ]);
  for (const token of list(source.resources.tokens, 128)) identifier(token);
  for (const icon of list(source.resources.icons, 64)) {
    const value = record(icon, ['name', 'purpose'], 'icon requirement');
    identifier(value.name);
    if (
      typeof value.purpose !== 'string' ||
      !value.purpose.trim() ||
      value.purpose.length > 500
    )
      throw new Error('Invalid icon purpose.');
  }
  for (const asset of list(source.resources.assets, 64)) {
    const value = record(asset, ['path', 'purpose'], 'asset requirement');
    if (
      typeof value.path !== 'string' ||
      value.path.startsWith('/') ||
      value.path.includes('..') ||
      value.path.length > 256 ||
      !value.path
    )
      throw new Error('Invalid resource path.');
    if (
      typeof value.purpose !== 'string' ||
      !value.purpose.trim() ||
      value.purpose.length > 500
    )
      throw new Error('Invalid asset purpose.');
  }
  return {
    platforms: [...source.platforms].sort(),
    capabilities: unique(
      source.capabilities.map((item) => ({
        ...item,
        platforms: [...item.platforms].sort(),
      }))
    ),
    parts: unique(source.parts),
    resources: {
      ...source.resources,
      tokens: unique(source.resources.tokens),
      icons: unique(source.resources.icons),
      assets: unique(source.resources.assets),
    },
  };
}

export function compileComponentProgram(
  sourceInput: ComponentProgramSourceV1,
  decisionsInput: unknown,
  registry: readonly GrammarModuleV1[] = componentGrammarV1
): ComponentProgramCompilationV1 {
  const findings: ComponentProgramFindingV1[] = [];
  const finding = (
    code: ComponentProgramFindingV1['code'],
    subject: string,
    reason: string
  ) => findings.push({ code, subject, reason });
  const blocked = (): ComponentProgramCompilationV1 => ({
    schemaVersion: '1',
    disposition: findings.some((item) => item.code === 'invalid-composition')
      ? 'blocked'
      : findings.some((item) => item.code === 'missing-grammar-capability')
        ? 'missing-grammar-capability'
        : 'review-required',
    findings: unique(findings),
    program: null,
    fingerprint: null,
  });
  try {
    const order = validateComponentGrammar(registry);
    const grammar = new Map(registry.map((item) => [item.id, item]));
    const source = normalizedSource(sourceInput);
    const parsed = parseComponentProgramDecisions(decisionsInput);
    const decisions: ComponentProgramDecisionsV1 = {
      ...parsed,
      anatomy: sorted(parsed.anatomy),
      states: sorted(parsed.states),
      transitions: unique(parsed.transitions),
      modules: unique(parsed.modules),
    };
    const modules = new Map<
      string,
      ComponentProgramDecisionsV1['modules'][number]
    >();
    for (const selection of decisions.modules) {
      if (modules.has(selection.id))
        throw new Error(`Conflicting duplicate module ${selection.id}.`);
      if (!grammar.has(selection.id))
        finding(
          'missing-grammar-capability',
          selection.id,
          'Unknown reusable module.'
        );
      modules.set(selection.id, selection);
      if (!subset(selection.platforms, source.platforms))
        finding(
          'invalid-composition',
          selection.id,
          'Module scope exceeds source authority.'
        );
    }
    for (const requirement of source.capabilities)
      if (
        !registry.some((module) =>
          module.capabilities.includes(requirement.capability)
        )
      )
        finding(
          'missing-grammar-capability',
          requirement.capability,
          'No public grammar module implements this capability.'
        );
    if (findings.length) return blocked();
    // No subset search: implication closure over one bounded supplied graph.
    for (const id of [...order].reverse()) {
      const selection = modules.get(id);
      if (!selection) continue;
      const module = grammar.get(id)!;
      for (const implied of module.implies) {
        const definition = grammar.get(implied)!;
        const existing = modules.get(implied);
        if (!existing)
          modules.set(implied, {
            id: implied,
            platforms: selection.platforms,
            bindings: Object.fromEntries(
              definition.slots
                .filter((slot) => selection.bindings[slot.id])
                .map((slot) => [slot.id, selection.bindings[slot.id]])
            ),
          });
        else if (!subset(selection.platforms, existing.platforms))
          finding(
            'invalid-composition',
            id,
            `Implied module ${implied} does not cover the source scope.`
          );
      }
    }
    const states = new Map(decisions.states.map((state) => [state.id, state]));
    const admitted = new Set(
      [...modules.values()]
        .filter((selection) => {
          const definition = grammar.get(selection.id)!;
          return (
            definition.capabilities.length === 0 ||
            selection.platforms.every((platform) =>
              source.capabilities.some(
                (requirement) =>
                  requirement.platforms.includes(platform) &&
                  definition.capabilities.includes(requirement.capability)
              )
            )
          );
        })
        .map((selection) => selection.id)
    );
    for (const id of [...order].reverse())
      if (admitted.has(id))
        for (const implied of grammar.get(id)!.implies) admitted.add(implied);
    for (const selection of modules.values())
      if (!admitted.has(selection.id))
        finding(
          'invalid-composition',
          selection.id,
          'Selected capability module exceeds public source requirements.'
        );
    if (states.size !== decisions.states.length)
      throw new Error('Duplicate state authority.');
    const anatomy = new Map(decisions.anatomy.map((part) => [part.id, part]));
    if (anatomy.size !== decisions.anatomy.length)
      throw new Error('Duplicate anatomy authority.');
    const roots = decisions.anatomy.filter((part) => part.parent === null);
    if (roots.length !== 1 || roots[0].role !== 'root')
      finding(
        'invalid-composition',
        'anatomy',
        'Exactly one root is required.'
      );
    graphOrder(
      new Map(
        decisions.anatomy.map((part) => [
          part.id,
          part.parent === null ? [] : [part.parent],
        ])
      )
    );
    for (const part of source.parts)
      if (!anatomy.has(part))
        finding(
          'semantic-decision-required',
          part,
          'Public part lacks an anatomy binding.'
        );
    const transitionOwners = new Map<string, string>();
    for (const transition of decisions.transitions) {
      for (const platform of transition.platforms) {
        const key = `${transition.state}:${transition.event}:${platform}`;
        const previous = transitionOwners.get(key);
        if (previous !== undefined && previous !== transition.action)
          finding(
            'invalid-composition',
            transition.state,
            `Contradictory transition for ${transition.event} on ${platform}.`
          );
        transitionOwners.set(key, transition.action);
      }
      const state = states.get(transition.state);
      if (!state)
        finding(
          'invalid-composition',
          transition.state,
          'Transition references missing state.'
        );
      const allowedActions: Record<string, readonly string[]> = {
        boolean: [
          'request-change',
          'open',
          'close',
          'reset',
          'update',
          'derive',
        ],
        text: ['request-change', 'reset', 'update', 'derive'],
        selection: ['request-change', 'reset', 'update', 'derive'],
        'multi-selection': ['request-change', 'reset', 'update', 'derive'],
        'selection-union': ['request-change', 'reset', 'update', 'derive'],
        number: ['request-change', 'reset', 'update', 'derive'],
        collection: ['reset', 'update', 'cleanup', 'derive'],
        'image-status': ['reset', 'resolve', 'reject', 'cleanup'],
        deadline: ['reset', 'cleanup', 'update'],
        'pause-reasons': ['pause', 'resume', 'reset', 'cleanup'],
      };
      if (state && !allowedActions[state.domain].includes(transition.action))
        finding(
          'invalid-composition',
          state.id,
          'Transition action is incompatible with state domain.'
        );
      if (!subset(transition.platforms, source.platforms))
        finding(
          'invalid-composition',
          transition.state,
          'Transition scope exceeds source authority.'
        );
      if (
        state?.ownership === 'read-only' ||
        (state?.ownership === 'derived' && transition.action !== 'derive')
      )
        finding(
          'invalid-composition',
          transition.state,
          'Transition cannot mutate read-only or independently owned derived state.'
        );
      if (
        transition.event === 'keyboard' &&
        !modules.has('keyboard-navigation')
      )
        finding(
          'invalid-composition',
          transition.state,
          'Keyboard event requires navigation authority.'
        );
      if (
        ['pointer-enter', 'pointer-leave'].includes(transition.event) &&
        transition.platforms.includes('react-native')
      )
        finding(
          'invalid-composition',
          transition.state,
          'Browser pointer events cannot be shared native authority.'
        );
    }
    for (const selection of modules.values()) {
      const module = grammar.get(selection.id)!;
      for (const key of Object.keys(selection.parameters ?? {}))
        if (!module.parameters.some((parameter) => parameter.id === key))
          finding(
            'invalid-composition',
            module.id,
            `Unknown parameter ${key}.`
          );
      for (const parameter of module.parameters) {
        const value = selection.parameters?.[parameter.id];
        if (value === undefined)
          finding(
            'semantic-decision-required',
            module.id,
            `Missing approved parameter ${parameter.id}.`
          );
        else if (
          parameter.kind === 'choice'
            ? typeof value !== 'string' || !parameter.choices.includes(value)
            : typeof value !== 'number' ||
              value < parameter.minimum ||
              value > parameter.maximum
        )
          finding(
            'invalid-composition',
            module.id,
            `Parameter ${parameter.id} is outside its declared domain.`
          );
      }
      if (!subset(selection.platforms, module.platforms))
        finding(
          'invalid-composition',
          module.id,
          'Platform-only module used outside its allowed scope.'
        );
      for (const required of module.requires)
        if (
          !modules.has(required) ||
          !subset(selection.platforms, modules.get(required)!.platforms)
        )
          finding(
            'invalid-composition',
            module.id,
            `Requires ${required} on every selected platform.`
          );
      for (const conflict of module.conflicts)
        if (
          modules.has(conflict) &&
          overlaps(selection.platforms, modules.get(conflict)!.platforms)
        )
          finding(
            'invalid-composition',
            module.id,
            `Conflicts with ${conflict}.`
          );
      for (const role of module.roles)
        if (!decisions.anatomy.some((part) => part.role === role))
          finding(
            'semantic-decision-required',
            module.id,
            `Missing anatomy role ${role}.`
          );
      for (const binding of Object.keys(selection.bindings))
        if (!module.slots.some((slot) => slot.id === binding))
          finding(
            'invalid-composition',
            module.id,
            `Unknown state binding ${binding}.`
          );
      for (const slot of module.slots) {
        if (!overlaps(slot.platforms, selection.platforms)) continue;
        const state = states.get(selection.bindings[slot.id]);
        if (!state)
          finding(
            'semantic-decision-required',
            module.id,
            `Missing state binding ${slot.id}.`
          );
        else if (
          !slot.domains.includes(state.domain) ||
          !slot.owners.includes(state.ownership)
        )
          finding(
            'invalid-composition',
            module.id,
            `Incompatible domain/owner for ${slot.id}.`
          );
      }
      for (const required of module.transitions)
        for (const platform of required.platforms.filter((platform) =>
          selection.platforms.includes(platform)
        )) {
          if (
            !decisions.transitions.some(
              (item) =>
                item.state === selection.bindings[required.slot] &&
                item.event === required.event &&
                item.action === required.action &&
                item.platforms.includes(platform)
            )
          )
            finding(
              'semantic-decision-required',
              module.id,
              `Missing ${required.slot}:${required.event}:${required.action} on ${platform}.`
            );
        }
    }
    for (const requirement of source.capabilities)
      for (const platform of requirement.platforms) {
        if (
          ![...modules.values()].some(
            (module) =>
              module.platforms.includes(platform) &&
              grammar
                .get(module.id)!
                .capabilities.includes(requirement.capability)
          )
        )
          finding(
            'semantic-decision-required',
            requirement.capability,
            `Required capability has no selected module on ${platform}.`
          );
      }
    for (const interaction of componentGrammarInteractionsV1) {
      const left = modules.get(interaction.left);
      const right = modules.get(interaction.right);
      if (!left || !right || !overlaps(left.platforms, right.platforms))
        continue;
      if (
        interaction.kind === 'shared-state' &&
        left.bindings[interaction.slot] !== right.bindings[interaction.slot]
      )
        finding(
          'invalid-composition',
          `${left.id}+${right.id}`,
          `Shared state ${interaction.slot} has conflicting authority.`
        );
      if (
        interaction.kind === 'event-cannot-write' &&
        decisions.transitions.some(
          (item) =>
            item.state === left.bindings[interaction.slot] &&
            item.event === interaction.event
        )
      )
        finding(
          'invalid-composition',
          `${left.id}+${right.id}`,
          'Presentation preference cannot mutate the active deadline.'
        );
    }
    for (const capability of ['controlled', 'uncontrolled'] as const) {
      if (
        source.capabilities.some((item) => item.capability === capability) &&
        !decisions.states.some((state) =>
          [capability, 'controlled-uncontrolled'].includes(state.ownership)
        )
      )
        finding(
          'semantic-decision-required',
          capability,
          'Declared ownership capability lacks a matching state owner.'
        );
    }
    const apiConsequences: ComponentProgramV1['apiConsequences'][number][] = [];
    for (const state of decisions.states) {
      const controlled = ['controlled', 'controlled-uncontrolled'].includes(
        state.ownership
      );
      const uncontrolled = ['uncontrolled', 'controlled-uncontrolled'].includes(
        state.ownership
      );
      if (controlled || uncontrolled) {
        if (!modules.has('state-control'))
          finding(
            'invalid-composition',
            state.id,
            'Externally managed state requires state-control module.'
          );
        for (const capability of [
          ...(controlled ? ['controlled'] : []),
          ...(uncontrolled ? ['uncontrolled'] : []),
        ])
          if (
            !source.capabilities.some(
              (item) =>
                item.capability === capability &&
                subset(source.platforms, item.platforms)
            )
          )
            finding(
              'invalid-composition',
              state.id,
              `State ownership exceeds declared ${capability} authority.`
            );
        if (state.api === 'none' || state.api === 'review-required') {
          finding(
            'semantic-decision-required',
            state.id,
            'Choose an approved API convention; ownership alone does not choose names.'
          );
          continue;
        }
        const valueType = (
          {
            boolean: 'boolean',
            text: 'string',
            selection: 'string',
            'multi-selection': 'string[]',
            number: 'number',
          } as Partial<Record<string, string>>
        )[state.domain];
        if (state.domain === 'selection-union') {
          finding(
            'semantic-decision-required',
            state.id,
            'A discriminated selection API requires an approved convention; a flat union is not equivalent.'
          );
          continue;
        }
        if (
          !valueType ||
          (['open', 'checked'].includes(state.api) &&
            state.domain !== 'boolean')
        ) {
          finding(
            'invalid-composition',
            state.id,
            'API convention is incompatible with state domain.'
          );
          continue;
        }
        const title = state.api[0].toUpperCase() + state.api.slice(1);
        if (controlled)
          apiConsequences.push({
            state: state.id,
            name: state.api,
            kind: 'value',
            valueType,
            required: !uncontrolled,
          });
        if (uncontrolled)
          apiConsequences.push({
            state: state.id,
            name: `default${title}`,
            kind: 'initial',
            valueType,
            required: false,
          });
        apiConsequences.push({
          state: state.id,
          name: `on${title}Change`,
          kind: 'change',
          valueType,
          required: false,
        });
      } else if (state.api !== 'none')
        finding(
          'invalid-composition',
          state.id,
          'Internal/derived/read-only state cannot independently define a controllable API.'
        );
    }
    if (
      modules.has('state-control') &&
      !decisions.states.some((state) =>
        ['controlled', 'uncontrolled', 'controlled-uncontrolled'].includes(
          state.ownership
        )
      )
    )
      finding(
        'semantic-decision-required',
        'state-control',
        'Declared controlled/uncontrolled capability needs an explicit state domain and ownership.'
      );
    if (
      new Set(apiConsequences.map((item) => item.name)).size !==
      apiConsequences.length
    )
      finding(
        'invalid-composition',
        'api',
        'Two state owners project the same API member.'
      );
    if (findings.length) return blocked();
    const program: ComponentProgramV1 = {
      schemaVersion: '1',
      grammarFingerprint: programDigest('component-grammar-v1', {
        modules: sorted(registry),
        interactions: componentGrammarInteractionsV1,
      }),
      source,
      decisions: { ...decisions, modules: sorted([...modules.values()]) },
      order: order.filter((id) => modules.has(id)),
      capabilityTraces: sorted(
        source.capabilities.flatMap((requirement) =>
          requirement.platforms.flatMap((platform) =>
            [...modules.values()]
              .filter(
                (selection) =>
                  selection.platforms.includes(platform) &&
                  grammar
                    .get(selection.id)!
                    .capabilities.includes(requirement.capability)
              )
              .map((selection) => ({
                capability: requirement.capability,
                platform,
                module: selection.id,
                obligationIds: grammar
                  .get(selection.id)!
                  .obligations.filter((proof) =>
                    proof.platforms.includes(platform)
                  )
                  .map((proof) => `${selection.id}:${proof.id}`)
                  .sort(),
              }))
          )
        )
      ),
      apiConsequences: sorted(apiConsequences),
      platformPlans: source.platforms.map((platform) => ({
        platform,
        modules: order
          .filter((id) => modules.get(id)?.platforms.includes(platform))
          .map((id) => ({ id, adapter: grammar.get(id)!.adapters[platform]! })),
      })),
      obligations: sorted(
        [...modules.values()].flatMap((selection) =>
          selection.platforms.flatMap((platform) =>
            grammar
              .get(selection.id)!
              .obligations.filter((proof) => proof.platforms.includes(platform))
              .map(({ platforms: scope, ...proof }) => {
                if (!scope.includes(platform))
                  throw new Error('Invalid proof projection.');
                return {
                  ...proof,
                  id: `${selection.id}:${proof.id}`,
                  module: selection.id,
                  platform,
                };
              })
          )
        )
      ),
    };
    return {
      schemaVersion: '1',
      disposition: 'compiled',
      findings: [],
      program,
      fingerprint: programDigest('component-program-v1', program),
    };
  } catch (error) {
    finding(
      'invalid-composition',
      'program',
      error instanceof Error ? error.message : 'Invalid program input.'
    );
    return blocked();
  }
}

export function verifyComponentProgram(
  program: ComponentProgramV1,
  fingerprint: string,
  source: ComponentProgramSourceV1
): void {
  const result = compileComponentProgram(source, program.decisions);
  if (
    result.disposition !== 'compiled' ||
    result.fingerprint !== fingerprint ||
    canonicalProgramJson(result.program) !== canonicalProgramJson(program)
  )
    throw new Error(
      'Component Program identity, source authority or deterministic projection drift.'
    );
}
