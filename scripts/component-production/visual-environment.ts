/** The direct entrypoint still executes assert-canonical-visual-environment.mjs.
 * A declaration selects execution transport; it never certifies a visual pass.
 */
export function componentProductionVisualCommand(
  environment: NodeJS.ProcessEnv = process.env
): readonly string[] {
  return environment.VELLIRA_VISUAL_ENVIRONMENT
    ? ['pnpm', 'test:e2e:web:visual']
    : ['pnpm', 'test:e2e:web:visual:docker'];
}
