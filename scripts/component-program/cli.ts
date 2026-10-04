import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseComponentProductionInput } from '../component-production/contracts';
import { canonicalProgramJson, compileComponentProgram } from './compile';
import { componentProgramSource } from './source';

/** stdin only: private consumers invoke the compiler in their exact public checkout. */
export function compileProductionProgram(value: unknown) {
  const input = parseComponentProductionInput(value);
  if (!input.componentProgram)
    throw new Error(
      'An explicit reviewed Component Program decision is required.'
    );
  return compileComponentProgram(
    componentProgramSource(input),
    input.componentProgram
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const input = fs.readFileSync(0, 'utf8');
    if (Buffer.byteLength(input) > 131072)
      throw new Error('Program compiler input exceeds 128 KiB.');
    const result = compileProductionProgram(JSON.parse(input));
    process.stdout.write(canonicalProgramJson(result) + '\n');
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Invalid program input'}\n`
    );
    process.exitCode = 1;
  }
}
