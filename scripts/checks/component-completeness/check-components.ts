import { checkReadmeComponentInventory } from '../../readme-components';
import { runComponentCompletenessCli } from './cli';

try {
  await runComponentCompletenessCli(process.argv.slice(2));

  if (process.argv.slice(2).includes('--all')) {
    await checkReadmeComponentInventory();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));

  process.exitCode = 1;
}
