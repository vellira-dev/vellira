import { auditComponentDiscoveryCatalog } from './component-discovery-audit';

const report = auditComponentDiscoveryCatalog();

if (report.findings.length > 0) {
  console.error('Component Discovery Content V1 audit failed:');
  for (const finding of report.findings) {
    console.error('  - ' + finding);
  }
  process.exitCode = 1;
} else {
  console.log(
    'Component Discovery Content V1: ' +
      report.checked +
      ' checked, ' +
      report.adopted +
      ' adopted, ' +
      report.exempt +
      ' explicit legacy exceptions'
  );
}
