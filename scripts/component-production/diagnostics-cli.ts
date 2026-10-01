import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { runComponentProductionDiagnostics } from './diagnostics';

export function runComponentProductionDiagnosticCli(
  args: readonly string[]
): number {
  try {
    const values = new Map<string, string>();
    const accepted = new Set([
      '--spec',
      '--candidate-snapshot',
      '--provider-response-sha256',
    ]);
    for (let index = 0; index < args.length; index += 2) {
      const name = args[index];
      const value = args[index + 1];
      if (
        !name ||
        !accepted.has(name) ||
        values.has(name) ||
        !value ||
        value.startsWith('--')
      ) {
        throw new Error(
          'Expected unique --spec, --candidate-snapshot and optional ' +
            '--provider-response-sha256.'
        );
      }
      values.set(name, value);
    }
    const spec = values.get('--spec');
    const snapshot = values.get('--candidate-snapshot');
    if (!spec || !snapshot) {
      throw new Error('--spec and --candidate-snapshot are required.');
    }
    const report = runComponentProductionDiagnostics({
      root: process.cwd(),
      input: JSON.parse(fs.readFileSync(spec, 'utf8')),
      candidateSnapshot: JSON.parse(fs.readFileSync(snapshot, 'utf8')),
      providerResponseSha256: values.get('--provider-response-sha256'),
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status === 'incomplete') return 2;
    return report.relativeImports.length ||
      report.reviewSurfaces.some(
        (surface) => surface.required && surface.status === 'missing'
      ) ||
      report.entries.some((entry) => entry.result?.status !== 'passed')
      ? 1
      : 0;
  } catch (error) {
    console.error(
      JSON.stringify({
        schemaVersion: '1',
        kind: 'component-production-diagnostics',
        readinessAuthority: false,
        readyForReview: false,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    );
    return 2;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = runComponentProductionDiagnosticCli(process.argv.slice(2));
}
