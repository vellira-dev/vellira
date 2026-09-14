import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolveComponentProductionEligibility } from './production-eligibility';
import { componentTokenReservationRequest } from '../canonical-gap/token-reservation';

export function runProductionEligibilityCli(
  args: readonly string[],
  root = process.cwd(),
  write = console.log,
  writeError = console.error
) {
  try {
    if (
      args.length !== 2 ||
      args[0] !== '--seed' ||
      !args[1] ||
      args[1].startsWith('--')
    ) {
      throw new Error(
        'Usage: node --import tsx scripts/component-production/eligibility-cli.ts --seed <seed.json>'
      );
    }
    const eligibility = resolveComponentProductionEligibility(
      JSON.parse(fs.readFileSync(args[1], 'utf8')),
      root
    );
    const reservation =
      eligibility.reason === 'component-token-reservation-required'
        ? componentTokenReservationRequest(
            eligibility.seed,
            `component-production:${eligibility.seed.componentName}`
          )
        : null;
    write(JSON.stringify({ eligibility, reservation }));
    return eligibility.hardInvalid ? 2 : eligibility.eligible ? 0 : 1;
  } catch (error) {
    writeError(
      JSON.stringify({
        schemaVersion: '1',
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
  process.exitCode = runProductionEligibilityCli(process.argv.slice(2));
}
