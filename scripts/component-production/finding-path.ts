import path from 'node:path';

/** Exact source evidence only; directories and traversal never become write paths. */
export function findingSourcePaths(
  evidence: readonly string[] | undefined
): string[] {
  const paths = new Set<string>();
  for (const item of evidence ?? []) {
    const match =
      /^(?:[a-z][a-z0-9-]*: )?((?:packages|apps|scripts)\/[A-Za-z0-9_./-]+\.[a-z0-9]+)(?::\d+(?::\d+)?)?(?: — .*| is missing)?$/i.exec(
        item.trim().replaceAll('\\', '/')
      );
    if (!match) continue;
    const source = match[1];
    if (
      path.posix.normalize(source) !== source ||
      source.split('/').includes('..')
    )
      continue;
    paths.add(source);
  }
  return [...paths].sort();
}

export function qualityFindingSourcePaths(
  ruleId: string,
  evidence: readonly string[] | undefined
): (string | undefined)[] {
  const paths = findingSourcePaths(evidence);
  const absence = [
    'platform.interaction',
    'platform.overlay-presentation',
    'platform.focus-management',
  ].includes(ruleId);
  const exact = absence
    ? paths.filter((p) => p.endsWith('.tsx') && !p.endsWith('.test.tsx'))
    : paths;
  return (exact.length === 1 || ruleId === 'conformity.icon-resources') &&
    exact.length > 0
    ? exact
    : [undefined];
}
