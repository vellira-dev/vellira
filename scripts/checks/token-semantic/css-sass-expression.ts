import { maskCssNonCode } from './css-references';

type Range = {
  start: number;
  end: number;
};

type EachScope = Range & {
  variable: string;
  values: readonly string[];
};

type MixinDefinition = Range & {
  name: string;
  parameters: readonly string[];
};

type MixinInclude = {
  name: string;
  arguments: readonly string[];
  index: number;
};

export type DynamicCssVariableResolver = (
  expression: string,
  referenceIndex: number
) => readonly string[] | null;

function findClosingBrace(code: string, openBrace: number): number | null {
  let depth = 0;

  for (let index = openBrace; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1;
    else if (code[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return null;
}

function splitArguments(value: string): readonly string[] {
  const values: string[] = [];
  let start = 0;
  let parentheses = 0;
  let braces = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '(') parentheses += 1;
    else if (character === ')' && parentheses > 0) parentheses -= 1;
    else if (character === '{') braces += 1;
    else if (character === '}' && braces > 0) braces -= 1;
    else if (character === ',' && parentheses === 0 && braces === 0) {
      values.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }

  values.push(value.slice(start).trim());
  return values.filter(Boolean);
}

function parseLiteralValues(
  value: string,
  lists: ReadonlyMap<string, readonly string[]>
): readonly string[] | null {
  const trimmed = value.trim();
  const variable = trimmed.match(/^\$([\w-]+)$/)?.[1];
  if (variable) return lists.get(variable) ?? null;

  const values = splitArguments(trimmed);
  if (
    values.length === 0 ||
    values.some((item) => !/^[A-Za-z0-9_-]+$/.test(item))
  ) {
    return null;
  }

  return values;
}

function parseLists(code: string): ReadonlyMap<string, readonly string[]> {
  const lists = new Map<string, readonly string[]>();

  for (const match of code.matchAll(/\$([\w-]+)\s*:\s*([^;{}]+);/g)) {
    const name = match[1];
    const rawValue = match[2];
    if (!name || !rawValue) continue;
    const values = parseLiteralValues(rawValue, lists);
    if (values) lists.set(name, values);
  }

  return lists;
}

function parseEachScopes(
  code: string,
  lists: ReadonlyMap<string, readonly string[]>
): readonly EachScope[] {
  const scopes: EachScope[] = [];

  for (const match of code.matchAll(/@each\s+\$([\w-]+)\s+in\s+([^{}]+)\{/g)) {
    const variable = match[1];
    const rawValues = match[2];
    if (!variable || !rawValues || match.index === undefined) continue;

    const values = parseLiteralValues(rawValues, lists);
    if (!values) continue;

    const openBrace = code.indexOf('{', match.index);
    const end = findClosingBrace(code, openBrace);
    if (openBrace < 0 || end === null) continue;

    scopes.push({ variable, values, start: openBrace + 1, end });
  }

  return scopes;
}

function parseMixinDefinitions(code: string): readonly MixinDefinition[] {
  const definitions: MixinDefinition[] = [];

  for (const match of code.matchAll(/@mixin\s+([\w-]+)\s*\(([^)]*)\)\s*\{/g)) {
    const name = match[1];
    const rawParameters = match[2];
    if (!name || rawParameters === undefined || match.index === undefined) {
      continue;
    }

    const openBrace = code.indexOf('{', match.index);
    const end = findClosingBrace(code, openBrace);
    if (openBrace < 0 || end === null) continue;

    const parameters = splitArguments(rawParameters)
      .map((parameter) => parameter.match(/^\$([\w-]+)/)?.[1] ?? null)
      .filter((parameter): parameter is string => parameter !== null);

    definitions.push({ name, parameters, start: openBrace + 1, end });
  }

  return definitions;
}

function parseMixinIncludes(code: string): readonly MixinInclude[] {
  const includes: MixinInclude[] = [];

  for (const match of code.matchAll(/@include\s+([\w-]+)\s*\(([^;]*?)\)\s*;/g)) {
    const name = match[1];
    const rawArguments = match[2];
    if (!name || rawArguments === undefined || match.index === undefined) {
      continue;
    }

    includes.push({
      name,
      arguments: splitArguments(rawArguments),
      index: match.index,
    });
  }

  return includes;
}

function domainAt(
  scopes: readonly EachScope[],
  variable: string,
  index: number
): readonly string[] | null {
  const matching = scopes
    .filter(
      (scope) =>
        scope.variable === variable && scope.start <= index && index <= scope.end
    )
    .sort((left, right) => left.end - left.start - (right.end - right.start));

  return matching[0]?.values ?? null;
}

function argumentDomain(
  argument: string,
  index: number,
  scopes: readonly EachScope[]
): readonly string[] | null {
  const trimmed = argument.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return [trimmed];

  const variable = trimmed.match(/^\$([\w-]+)$/)?.[1];
  return variable ? domainAt(scopes, variable, index) : null;
}

function containingMixin(
  definitions: readonly MixinDefinition[],
  variable: string,
  index: number
): MixinDefinition | null {
  return (
    definitions
      .filter(
        (definition) =>
          definition.start <= index &&
          index <= definition.end &&
          definition.parameters.includes(variable)
      )
      .sort(
        (left, right) =>
          left.end - left.start - (right.end - right.start)
      )[0] ?? null
  );
}

function mixinParameterDomain(
  definition: MixinDefinition,
  variable: string,
  includes: readonly MixinInclude[],
  scopes: readonly EachScope[]
): readonly string[] | null {
  const parameterIndex = definition.parameters.indexOf(variable);
  if (parameterIndex < 0) return null;

  const values = new Set<string>();
  let unresolved = false;

  for (const include of includes) {
    if (include.name !== definition.name) continue;
    const argument = include.arguments[parameterIndex];
    if (argument === undefined) {
      unresolved = true;
      continue;
    }

    const domain = argumentDomain(argument, include.index, scopes);
    if (!domain) {
      unresolved = true;
      continue;
    }
    for (const value of domain) values.add(value);
  }

  if (unresolved || values.size === 0) return null;
  return [...values].sort();
}

function expandExpression(
  expression: string,
  domains: ReadonlyMap<string, readonly string[]>
): readonly string[] | null {
  const interpolationVariables = [
    ...new Set(
      [...expression.matchAll(/#\{\$([\w-]+)\}/g)]
        .map((match) => match[1])
        .filter((value): value is string => value !== undefined)
    ),
  ];
  if (interpolationVariables.length === 0) return null;

  let expanded = [expression];
  for (const variable of interpolationVariables) {
    const values = domains.get(variable);
    if (!values || values.length === 0) return null;

    expanded = expanded.flatMap((candidate) =>
      values.map((value) => candidate.replaceAll(`#{$${variable}}`, value))
    );
    if (expanded.length > 500) return null;
  }

  if (
    expanded.some(
      (candidate) =>
        candidate.includes('#{') || !/^--[A-Za-z0-9_-]+$/.test(candidate)
    )
  ) {
    return null;
  }

  return [...new Set(expanded)].sort();
}

export function createScssVariableExpressionResolver(
  sourcePath: string,
  source: string
): DynamicCssVariableResolver | null {
  if (!sourcePath.endsWith('.scss')) return null;

  const code = maskCssNonCode(source, true);
  const lists = parseLists(code);
  const scopes = parseEachScopes(code, lists);
  const definitions = parseMixinDefinitions(code);
  const includes = parseMixinIncludes(code);

  return (expression, referenceIndex) => {
    const interpolationVariables = [
      ...new Set(
        [...expression.matchAll(/#\{\$([\w-]+)\}/g)]
          .map((match) => match[1])
          .filter((value): value is string => value !== undefined)
      ),
    ];
    if (interpolationVariables.length === 0) return null;

    const domains = new Map<string, readonly string[]>();
    for (const variable of interpolationVariables) {
      const definition = containingMixin(definitions, variable, referenceIndex);
      const domain = definition
        ? mixinParameterDomain(definition, variable, includes, scopes)
        : domainAt(scopes, variable, referenceIndex);
      if (!domain) return null;
      domains.set(variable, domain);
    }

    return expandExpression(expression, domains);
  };
}
