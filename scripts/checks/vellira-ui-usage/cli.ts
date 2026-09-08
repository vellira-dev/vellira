import { runVelliraUiUsageCheck } from './checker';

const report = runVelliraUiUsageCheck();
const json = process.argv.includes('--json');

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  printHumanReport();
}

process.exitCode = report.summary.blockingFindings > 0 ? 1 : 0;

function printHumanReport() {
  console.log(
    `Vellira UI usage audit: ${report.summary.findings} finding(s), ${report.summary.exceptionsApplied} explicit exception(s), ${report.summary.filesScanned} file(s) scanned.`
  );

  for (const finding of report.findings) {
    const alternative = finding.canonicalAlternative
      ? ` -> ${finding.canonicalAlternative}`
      : '';
    console.log(
      `${finding.path}:${finding.line}:${finding.column} [${finding.ruleId}] <${finding.detected}>${alternative}`
    );
    console.log(`  ${finding.message}`);
  }

  for (const exception of report.exceptions) {
    console.log(
      `${exception.path}:${exception.line}:${exception.column} [exception:${exception.category}] ${exception.ruleId} <${exception.detected}> ${exception.issue}`
    );
    console.log(`  ${exception.reason}`);
  }

  if (report.findings.length === 0) {
    console.log('No first-party UI usage findings.');
  }

  console.log(
    'Audit mode is non-blocking. Classify and repair the baseline in #852 before enabling enforcement.'
  );
}
