/** The direct entrypoint still executes assert-canonical-visual-environment.mjs.
 * A declaration selects execution transport; it never certifies a visual pass.
 */
export function componentProductionVisualCommand(
  environment: Readonly<Record<string, string | undefined>> = process.env
): readonly string[] {
  return environment.VELLIRA_VISUAL_ENVIRONMENT
    ? [
        'pnpm',
        '--filter',
        '@vellira-ui/react-storybook',
        'exec',
        'node',
        fileURLToPath(new URL('../visual/run.mjs', import.meta.url)),
      ]
    : [
        'docker',
        'compose',
        '--profile',
        'test',
        'run',
        '--rm',
        '--volume',
        `${fileURLToPath(new URL('../../', import.meta.url))}:/vellira-validation-tools:ro`,
        '-e',
        'PLAYWRIGHT_SCRIPT=exec node /vellira-validation-tools/scripts/visual/run.mjs',
        'playwright',
      ];
}
import { fileURLToPath } from 'node:url';
