import path from 'node:path';

import {
  readBaseLifecycleStatuses,
  validateCanonicalLifecycleTransitions,
} from './lifecycle';

export async function runComponentLifecycleCli(
  args: readonly string[],
  rootDir = process.cwd(),
  write: (message: string) => void = console.log,
  writeError: (message: string) => void = console.error
) {
  const baseIndex = args.indexOf('--base');
  const unknown = args.filter(
    (arg, index) =>
      arg !== '--base' && (baseIndex === -1 || index !== baseIndex + 1)
  );

  if (
    unknown.length > 0 ||
    (baseIndex !== -1 && !args[baseIndex + 1]) ||
    args.length > (baseIndex === -1 ? 0 : 2)
  ) {
    writeError(
      'Component lifecycle validation error: Usage: pnpm check:component-lifecycle [--base <revision>]'
    );
    return 2;
  }

  const baseRevision =
    (baseIndex === -1 ? undefined : args[baseIndex + 1]) ??
    process.env.VELLIRA_LIFECYCLE_BASE_SHA ??
    'origin/main';
  const root = path.resolve(rootDir);

  try {
    const previousStatuses = readBaseLifecycleStatuses({
      rootDir: root,
      baseRevision,
    });
    const results = await validateCanonicalLifecycleTransitions({
      previousStatuses,
    });
    const changed = results.filter((result) => result.previous !== result.next);

    for (const result of changed) {
      write(
        `${result.valid ? 'PASS' : 'FAIL'} ${result.component}: ${result.previous ?? 'unregistered'} -> ${result.next}${result.error ? ` — ${result.error}` : ''}`
      );
    }

    if (changed.length === 0) {
      write('PASS No component lifecycle transitions detected.');
    }

    return results.every((result) => result.valid) ? 0 : 1;
  } catch (error) {
    writeError(
      `Component lifecycle validation error: ${error instanceof Error ? error.message : String(error)}`
    );
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runComponentLifecycleCli(process.argv.slice(2));
}
