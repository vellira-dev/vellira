import { fileURLToPath } from 'node:url';

/** Keep nested generator calls on the same tooling revision and candidate cwd. */
export function componentPageScriptCommand(
  script:
    | 'audit-catalog-previews.ts'
    | 'generate-component-pages.ts'
    | 'create-component-page.ts',
  args: readonly string[] = []
): [string, ...string[]] {
  return [
    process.execPath,
    '--import',
    fileURLToPath(
      new URL('../../../../node_modules/tsx/dist/loader.mjs', import.meta.url)
    ),
    fileURLToPath(new URL(`../${script}`, import.meta.url)),
    ...args,
  ];
}
