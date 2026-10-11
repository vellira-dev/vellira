import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseComponentProductionInput,
  createComponentProductionGeneratorOptions,
} from '../../component-production/contracts';
import { createComponentGenerationPlan } from './plan';
import {
  getPublicSymbolContractFile,
  assertRegularRepositoryFile,
  renderSynchronizedSharedSymbolContract,
} from './public-api-contract';

/** Refresh one derived shared-type inventory from the exact materialized contract.
 * Does not regenerate a component, semantic contract, metadata or renderer. */
export function refreshSharedSymbolInventory(
  root: string,
  input: unknown,
  check: boolean
) {
  const spec = parseComponentProductionInput(input);
  const plan = createComponentGenerationPlan({
    root,
    options: createComponentProductionGeneratorOptions(spec),
  });
  if (plan.typeOwnership !== 'shared' || !fs.existsSync(plan.sharedTypesFile))
    throw new Error('Materialized shared type authority is required.');
  const file = getPublicSymbolContractFile(root);
  assertRegularRepositoryFile(root, file);
  const before = fs.readFileSync(file, 'utf8');
  const after = renderSynchronizedSharedSymbolContract(before, plan);
  if (!check && before !== after) fs.writeFileSync(file, after);
  return {
    schemaVersion: '1',
    changedPaths: before === after ? [] : [path.relative(root, file)],
    check,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [flag, specPath, mode, ...extra] = process.argv.slice(2);
  if (
    flag !== '--spec' ||
    !specPath ||
    !['--check', '--write'].includes(mode) ||
    extra.length
  )
    throw new Error(
      'Usage: refresh-public-symbol-contract --spec <approved-spec.json> <--check|--write>'
    );
  const result = refreshSharedSymbolInventory(
    process.cwd(),
    JSON.parse(fs.readFileSync(specPath, 'utf8')),
    mode === '--check'
  );
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result.check && result.changedPaths.length) process.exitCode = 1;
}
