import type { FindingInput } from './contract';

/** Mask comments and quoted strings without shifting source locations. */
export function maskCssNonCode(source: string, scss: boolean): string {
  const chars = source.split('');
  let index = 0;
  while (index < source.length) {
    const start = index;
    const character = source[index];
    if (/^url\(/i.test(source.slice(index, index + 4))) {
      index += 4;
      let closed = false;
      let quote = '';
      while (index < source.length) {
        const current = source[index++];
        if (current === '\\') index += 1;
        else if (quote) {
          if (current === quote) quote = '';
        } else if (current === '"' || current === "'") {
          quote = current;
        } else if (current === ')') {
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error('Unterminated CSS URL.');
    } else if (character === '"' || character === "'") {
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2;
        } else if (source[index++] === character) {
          closed = true;
          break;
        }
      }
      if (!closed) throw new Error('Unterminated CSS string.');
    } else if (source.slice(index, index + 2) === '/*') {
      const end = source.indexOf('*/', index + 2);
      if (end === -1) throw new Error('Unterminated CSS comment.');
      index = end + 2;
    } else if (scss && source.slice(index, index + 2) === '//') {
      const end = source.indexOf('\n', index + 2);
      index = end === -1 ? source.length : end;
    } else {
      index += 1;
      continue;
    }
    const end = Math.min(index, chars.length);
    for (let cursor = start; cursor < end; cursor += 1) {
      if (chars[cursor] !== '\n' && chars[cursor] !== '\r') chars[cursor] = ' ';
    }
  }
  return chars.join('');
}

function namespace(variable: string): string {
  return variable.slice(2).split('-')[0] ?? '';
}

function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function localComponentVariablePrefix(sourcePath: string): string | null {
  const match = sourcePath.match(
    /^packages\/react\/src\/(?:components|primitives|patterns)\/([^/]+)\//
  );
  const componentName = match?.[1];
  return componentName ? `--${kebabCase(componentName)}-` : null;
}

export function declaredCssVariables(
  sourcePath: string,
  source: string
): ReadonlySet<string> {
  const code = maskCssNonCode(source, sourcePath.endsWith('.scss'));
  return new Set(
    [...code.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/g)].map((match) => match[1])
  );
}

/** Read the whole name, never a static prefix of a Sass interpolation. */
function readVariableArgument(code: string, start: number): string {
  let braces = 0;
  let parentheses = 0;
  for (let index = start; index < code.length; index += 1) {
    const character = code[index];
    if (character === '{') braces += 1;
    else if (character === '}' && braces > 0) braces -= 1;
    else if (braces === 0) {
      if (character === '(') parentheses += 1;
      else if (character === ')') {
        if (parentheses === 0) return code.slice(start, index).trim();
        parentheses -= 1;
      } else if (character === ',' && parentheses === 0) {
        return code.slice(start, index).trim();
      }
    }
  }
  throw new Error('Unterminated CSS variable reference.');
}

export function auditCssReferences(
  sourcePath: string,
  source: string,
  canonicalVariables: ReadonlySet<string>,
  providerVariables: ReadonlySet<string> = new Set(),
  candidateProviderVariables: ReadonlySet<string> = new Set()
): FindingInput[] {
  if (canonicalVariables.size === 0) {
    throw new Error('Canonical CSS-variable authority is empty.');
  }
  const code = maskCssNonCode(source, sourcePath.endsWith('.scss'));
  const prefixes = new Set([...canonicalVariables].map(namespace));
  const declared = declaredCssVariables(sourcePath, source);
  const localComponentPrefix = localComponentVariablePrefix(sourcePath);
  const findings: FindingInput[] = [];

  for (const match of code.matchAll(/(?<![\w-])var\(\s*/gi)) {
    const index = match.index + match[0].length;
    const variable = readVariableArgument(code, index);
    const before = source.slice(0, index);
    const location = {
      sourcePath,
      tokenPath: variable,
      line: before.split('\n').length,
      column: index - before.lastIndexOf('\n'),
      layer: 'consumer',
      theme: null,
      platform: 'web',
    };
    if (!/^--[\w-]+$/.test(variable)) {
      findings.push({
        ruleId: 'tokens.consumer-reference',
        code: 'unresolved-css-variable-expression',
        severity: 'warning',
        ...location,
        evidence: `Cannot statically resolve the full variable expression: ${variable}`,
        expected: 'A complete static name resolved through its source owner.',
        migrationStatus: 'untracked',
        suggestedAction:
          'Resolve interpolation/escapes before classifying this as a missing token.',
      });
      continue;
    }
    if (canonicalVariables.has(variable) || providerVariables.has(variable)) {
      continue;
    }
    if (
      declared.has(variable) &&
      localComponentPrefix !== null &&
      variable.startsWith(localComponentPrefix)
    ) {
      continue;
    }
    if (candidateProviderVariables.has(variable)) {
      findings.push({
        ruleId: 'tokens.consumer-reference',
        code: 'unproven-provider-boundary',
        severity: 'warning',
        ...location,
        evidence: `${variable} has a provider in the same component family, but the scanner has not proven that provider is an ancestor/import owner of this stylesheet.`,
        expected:
          'A statically proven provider relationship or canonical token.',
        migrationStatus: 'not-applicable',
        suggestedAction:
          'Prove the component provider relationship before marking this reference complete.',
      });
      continue;
    }
    const tokenNamespace = prefixes.has(namespace(variable));
    // A declaration in one file never exempts consumers in unrelated files.
    // Unknown token-prefixed declarations still need ownership review, except
    // for component-owned implementation variables proven in their own family.
    if (declared.has(variable) && !tokenNamespace) continue;
    const local = declared.has(variable);
    findings.push({
      ruleId: 'tokens.consumer-reference',
      code: local
        ? 'token-namespace-local-override'
        : tokenNamespace
          ? 'missing-token-variable'
          : 'unclassified-css-variable',
      severity: tokenNamespace && !local ? 'error' : 'warning',
      ...location,
      evidence: `${variable} is absent from the canonical generated CSS-variable registry.`,
      expected:
        'A current token, registered compatibility alias, or proven local/provider owner.',
      migrationStatus: 'untracked',
      suggestedAction: local
        ? 'Prove local ownership without creating an undocumented token alias.'
        : tokenNamespace
          ? 'Use the canonical replacement or register the missing design resource.'
          : 'Resolve the local import/provider before enabling blocking enforcement.',
    });
  }
  return findings;
}
