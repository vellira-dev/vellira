import { checkTokenOwnership } from './checker';

const args = new Set(process.argv.slice(2));
const reportOnly = args.has('--report');
const json = args.has('--json');
const report = checkTokenOwnership(process.cwd());

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Token ownership: ${report.componentFamilies.length} component families, ${report.semanticNamespaces.length} semantic namespaces, ${report.findings.length} findings.`
  );

  for (const finding of report.findings) {
    console.log(`- [${finding.code}] ${finding.path}: ${finding.message}`);
  }
}

if (!reportOnly && report.findings.length > 0) {
  process.exitCode = 1;
}
