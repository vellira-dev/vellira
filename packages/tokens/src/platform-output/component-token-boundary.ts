import { isComponentPlatformIntent } from './component-token-intents.js';

export type ComponentTokenBoundaryFinding = {
  path: string;
  reason: string;
};

const rendererKeys = new Set([
  'web',
  'native',
  'reactNative',
  'nativeMaxHeight',
]);

/** Shared #884 boundary check; platform intents remain atomic contracts. */
export function scanCanonicalComponentTokens(
  value: unknown,
  path: string,
  findings: ComponentTokenBoundaryFinding[]
): void {
  if (isComponentPlatformIntent(value)) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      scanCanonicalComponentTokens(entry, `${path}.${index}`, findings)
    );
    return;
  }

  if (typeof value !== 'object' || value === null) {
    if (path.endsWith('.shadow') && typeof value === 'string') {
      findings.push({
        path,
        reason: 'canonical shadow contains renderer-specific CSS syntax',
      });
    }
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;

    if (
      rendererKeys.has(key) ||
      key.startsWith('native') ||
      key.startsWith('reactNative')
    ) {
      findings.push({
        path: childPath,
        reason: `renderer-specific canonical key "${key}"`,
      });
    }

    scanCanonicalComponentTokens(child, childPath, findings);
  }
}
