import { spawnSync } from 'node:child_process';

import { getGeneratedComponentPageComponents } from './component-page-components';
import { componentPageScriptCommand } from './helpers/command';

const args = process.argv.slice(2);

const check = args.includes('--check');
const json = args.includes('--json');
const help = args.includes('--help') || args.includes('-h');

const generatedComponentPageComponents = getGeneratedComponentPageComponents();

const helpText = `
Vellira component pages generator

Usage:
  pnpm component-pages:generate [options]

Options:
  --check    Check all generated component pages without writing files
  --json     Emit a machine-readable check result
  --help     Show this help message
  -h         Alias for --help

Examples:
  pnpm component-pages:generate
  pnpm component-pages:generate --check
`;

if (help) {
  console.log(helpText.trim());
  process.exit(0);
}

const supportedArgs = new Set(['--check', '--json', '--help', '-h']);
const unknownArgs = args.filter((arg) => !supportedArgs.has(arg));

if (unknownArgs.length > 0) {
  console.error(`Unknown option: ${unknownArgs.join(', ')}`);
  console.error('');
  console.error(helpText.trim());
  process.exit(1);
}

const failures: string[] = [];
const componentResults: {
  componentName: string;
  status: 'up-to-date' | 'stale';
  staleFiles: string[];
}[] = [];

for (const componentName of generatedComponentPageComponents) {
  if (!json) {
    console.log(
      check
        ? `=== Checking ${componentName} ===`
        : `=== Generating ${componentName} ===`
    );
  }

  const [command, ...commandArgs] = componentPageScriptCommand(
    'create-component-page.ts',
    [
      componentName,
      '--force',
      ...(check ? ['--check'] : []),
      ...(json ? ['--json'] : []),
    ]
  );

  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: json ? 'pipe' : 'inherit',
  });

  if (json && check) {
    try {
      const payload = JSON.parse(result.stdout);
      componentResults.push({
        componentName: payload.componentName,
        status: payload.status,
        staleFiles: payload.staleFiles,
      });
    } catch {
      console.error(result.stderr || result.stdout);
      failures.push(componentName);
      continue;
    }
  }

  if (result.status !== 0) {
    failures.push(componentName);
  }
}

if (failures.length > 0) {
  if (json && check) {
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: '1',
          status: 'stale',
          components: componentResults,
        },
        null,
        2
      )}\n`
    );
    process.exit(1);
  }

  console.error('');
  console.error(
    `${check ? 'Component page check' : 'Component page generation'} failed for: ${failures.join(', ')}`
  );
  process.exit(1);
}

if (!json) {
  console.log('');
}

if (check) {
  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          schemaVersion: '1',
          status: 'up-to-date',
          components: componentResults,
        },
        null,
        2
      )}\n`
    );
    process.exit(0);
  }

  console.log(
    `All ${generatedComponentPageComponents.length} generated component pages are up to date.`
  );
} else {
  console.log(
    `Generated ${generatedComponentPageComponents.length} component pages successfully.`
  );
}
