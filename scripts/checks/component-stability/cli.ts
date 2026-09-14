import type {
  ComponentStabilityGateStatus,
  ComponentStabilityReportV1,
} from '@vellira-ui/metadata';

import { runComponentStabilityCheck } from './engine';

function gateStatus(status: ComponentStabilityGateStatus) {
  return status.replace('-', '_').toUpperCase();
}

export function formatComponentStabilityReport(
  report: ComponentStabilityReportV1
) {
  const lines = [
    `${report.component} (${report.lifecycle})`,
    '',
    ...report.gates.map((gate) => {
      const reason = gate.reason ? ` — ${gate.reason}` : '';
      return `[${gateStatus(gate.status)}] ${gate.id}${reason}`;
    }),
  ];

  if (report.capabilities.length > 0) {
    lines.push('', 'Declared capability evidence');
    for (const capability of report.capabilities) {
      lines.push(
        `  [${gateStatus(capability.status)}] ${capability.platform}/${capability.capability}${capability.reason ? ` — ${capability.reason}` : ''}`
      );
    }
  }

  if (report.warnings.length > 0) {
    lines.push('', 'Non-blocking recommendations');
    for (const warning of report.warnings) {
      lines.push(`  [WARN] ${warning.ruleId} — ${warning.reason}`);
    }
  }

  if (report.blockers.length > 0) {
    lines.push('', 'Blockers');
    for (const blocker of report.blockers) {
      lines.push(
        `  ${blocker.gateId}/${blocker.code}${blocker.platform ? ` (${blocker.platform})` : ''}: ${blocker.message}`
      );
      for (const item of blocker.evidence ?? []) {
        lines.push(`    evidence: ${item}`);
      }
    }
  }

  lines.push('', report.status);
  return lines.join('\n');
}

export async function runComponentStabilityCli(
  args: readonly string[],
  write: (message: string) => void = console.log,
  writeError: (message: string) => void = console.error,
  runCheck = runComponentStabilityCheck
) {
  const componentNames = args.filter((arg) => !arg.startsWith('--'));
  const json = args.includes('--json');
  const unknownOptions = args.filter(
    (arg) => arg.startsWith('--') && arg !== '--json'
  );

  if (componentNames.length !== 1 || unknownOptions.length > 0) {
    writeError(
      'Component Stable gate error: Usage: pnpm check:component-stability <ComponentName> [--json]'
    );
    return 2;
  }

  try {
    const report = await runCheck({ componentName: componentNames[0]! });
    write(
      json
        ? JSON.stringify(report, null, 2)
        : formatComponentStabilityReport(report)
    );
    return report.status === 'STABLE_ELIGIBLE' ? 0 : 1;
  } catch (error) {
    writeError(
      `Component Stable gate error: ${error instanceof Error ? error.message : String(error)}`
    );
    return 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = await runComponentStabilityCli(process.argv.slice(2));
}
