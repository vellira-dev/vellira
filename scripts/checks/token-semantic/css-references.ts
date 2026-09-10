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

export function auditCssReferences(
  sourcePath: string,
  source: string,
  canonicalVariables: ReadonlySet<string>
): FindingInput[] {
  if (canonicalVariables.size === 0) {
    throw new Error('Canonical CSS-variable authority is empty.');
  }
  const code = maskCssNonCode(source, sourcePath.endsWith('.scss'));
  const prefixes = new Set([...canonicalVariables].map(namespace));
  const declared = new Set(
    [...code.matchAll(/(?:^|[;{])\s*(--[\w-]+)\s*:/g)].map((match) => match[1])
  );
  const findings: FindingInput[] = [];

  for (const match of code.matchAll(/(?<![\w-])var\(\s*(--[\w-]+)/gi)) {
    const variable = match[1]!;
    if (canonicalVariables.has(variable)) continue;
    const index = match.index + match[0].indexOf(variable);
    const before = source.slice(0, index);
    const tokenNamespace = prefixes.has(namespace(variable));
    // A declaration in one file never exempts consumers in unrelated files.
    // Unknown token-prefixed declarations still need ownership review.
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
      sourcePath,
      tokenPath: variable,
      line: before.split('\n').length,
      column: index - before.lastIndexOf('\n'),
      layer: 'consumer',
      theme: null,
      platform: 'web',
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
