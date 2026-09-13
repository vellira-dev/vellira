import { parseComponentGeneratorArgs } from './cli';
import { runComponentGenerator } from './run';
import {
  assertComponentGeneratorTokenSemanticReadiness,
  componentGeneratorCheckRequiresTokenSemanticGate,
} from './token-semantic-readiness';

let options;

try {
  options = parseComponentGeneratorArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

try {
  const result = await runComponentGenerator({
    root: process.cwd(),
    options,
  });

  if (result.check) {
    if (
      componentGeneratorCheckRequiresTokenSemanticGate({
        componentTokens: result.plan.componentTokens,
        requestedTokens: options.tokens,
      })
    ) {
      await assertComponentGeneratorTokenSemanticReadiness(process.cwd());
    }

    console.log(
      `Component generator check passed for ${result.plan.componentName}.`
    );
  } else if (result.dryRun) {
    console.log('DRY RUN');
    console.log('');

    for (const target of result.plan.targets) {
      console.log(
        `Would create ${target.packageName} ${result.plan.layer}/${result.plan.componentName}`
      );
    }

    console.log('');
    console.log(`Would create ${result.createdFiles.length} files.`);
    console.log(`Would update ${result.updatedFiles.length} files.`);
    console.log('');
    console.log('No files were written.');
  } else {
    for (const target of result.plan.targets) {
      console.log(
        `✅ Created ${target.packageName} ${result.plan.layer}/${result.plan.componentName}`
      );
    }

    console.log(
      `Generated ${result.createdFiles.length} files and updated ${result.updatedFiles.length} exports.`
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
