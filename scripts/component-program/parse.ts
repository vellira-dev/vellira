import {
  componentAnatomyRoles,
  componentApiConventions,
  componentProgramEvents,
  componentStateDomains,
  componentStateOwners,
  componentTransitionActions,
  type ComponentProgramDecisionsV1,
} from '../../packages/metadata/src/componentProgram';

export function record(
  value: unknown,
  keys: readonly string[],
  label: string,
  optional: readonly string[] = []
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key)) ||
    keys.some((key) => !optional.includes(key) && !Object.hasOwn(value, key))
  ) {
    throw new Error(`Invalid or unknown ${label} fields.`);
  }
  return value as Record<string, unknown>;
}

export function identifier(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z][A-Za-z0-9._-]{0,95}$/.test(value)
  ) {
    throw new Error('Invalid Component Program identifier.');
  }
  return value;
}

export function enumeration<T extends string>(
  value: unknown,
  choices: readonly T[]
): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) {
    throw new Error(`Unsupported Component Program value: ${String(value)}.`);
  }
  return value as T;
}

export function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(
      'Component Program array exceeds its finite bound or is invalid.'
    );
  return value;
}

export function platforms(value: unknown) {
  const result = list(value, 2).map((item) =>
    enumeration(item, ['react', 'react-native'] as const)
  );
  if (!result.length || new Set(result).size !== result.length)
    throw new Error(
      'Component Program platforms must be non-empty and unique.'
    );
  return result.sort();
}

export function parseComponentProgramDecisions(
  value: unknown
): ComponentProgramDecisionsV1 {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 65536)
    throw new Error('Component Program input exceeds 64 KiB.');
  const input = record(
    value,
    ['schemaVersion', 'anatomy', 'states', 'transitions', 'modules'],
    'Component Program'
  );
  enumeration(input.schemaVersion, ['1']);
  return {
    schemaVersion: '1',
    anatomy: list(input.anatomy, 64).map((value) => {
      const item = record(value, ['id', 'role', 'parent'], 'anatomy');
      return {
        id: identifier(item.id),
        role: enumeration(item.role, componentAnatomyRoles),
        parent: item.parent === null ? null : identifier(item.parent),
      };
    }),
    states: list(input.states, 32).map((value) => {
      const item = record(value, ['id', 'domain', 'ownership', 'api'], 'state');
      return {
        id: identifier(item.id),
        domain: enumeration(item.domain, componentStateDomains),
        ownership: enumeration(item.ownership, componentStateOwners),
        api: enumeration(item.api, componentApiConventions),
      };
    }),
    transitions: list(input.transitions, 128).map((value) => {
      const item = record(
        value,
        ['state', 'event', 'action', 'platforms'],
        'transition'
      );
      return {
        state: identifier(item.state),
        event: enumeration(item.event, componentProgramEvents),
        action: enumeration(item.action, componentTransitionActions),
        platforms: platforms(item.platforms),
      };
    }),
    modules: list(input.modules, 64).map((value) => {
      const item = record(
        value,
        ['id', 'platforms', 'bindings', 'parameters'],
        'module selection',
        ['parameters']
      );
      if (
        !item.bindings ||
        typeof item.bindings !== 'object' ||
        Array.isArray(item.bindings) ||
        Object.keys(item.bindings).length > 16
      )
        throw new Error('Invalid module state bindings.');
      const bindings = Object.fromEntries(
        Object.entries(item.bindings).map(([key, value]) => [
          identifier(key),
          identifier(value),
        ])
      );
      const parameters = item.parameters ?? {};
      if (
        !parameters ||
        typeof parameters !== 'object' ||
        Array.isArray(parameters) ||
        Object.keys(parameters).length > 16
      )
        throw new Error('Invalid module parameters.');
      for (const [key, value] of Object.entries(parameters)) {
        identifier(key);
        if (
          (typeof value !== 'string' || value.length > 96) &&
          (typeof value !== 'number' || !Number.isSafeInteger(value))
        )
          throw new Error(
            'Module parameters must be bounded strings or safe integers.'
          );
      }
      return {
        id: identifier(item.id),
        platforms: platforms(item.platforms),
        bindings,
        ...(Object.keys(parameters).length
          ? { parameters: parameters as Record<string, string | number> }
          : {}),
      };
    }),
  };
}
