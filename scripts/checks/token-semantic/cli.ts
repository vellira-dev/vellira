import { checkTokenSemantics } from './checker';
import { formatTokenSemanticReport, tokenSemanticExitCode } from './contract';

const args = process.argv.slice(2);
const json = args.includes('--json');
try {
  const unknown = args.filter((arg) => !['--json', '--report'].includes(arg));
  if (unknown.length > 0) {
    throw new Error(`Unknown arguments: ${unknown.join(', ')}`);
  }
  const report = checkTokenSemantics(process.cwd());
  console.log(
    json ? JSON.stringify(report, null, 2) : formatTokenSemanticReport(report)
  );
  process.exitCode = tokenSemanticExitCode(report, args.includes('--report'));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    console.log(
      JSON.stringify({ schemaVersion: 1, status: 'error', error: message })
    );
  } else {
    console.error(`Token semantic audit failed: ${message}`);
  }
  process.exitCode = 2;
}
