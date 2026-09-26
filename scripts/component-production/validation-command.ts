export type ValidationCommandInvocation<TExecution> =
  | { status: 'completed'; execution: TExecution }
  | { status: 'threw'; message: string };

export function invokeValidationCommand<TCommand, TExecution>(
  runner: (command: TCommand, root: string) => TExecution,
  command: TCommand,
  root: string
): ValidationCommandInvocation<TExecution> {
  try {
    return {
      status: 'completed',
      execution: runner(command, root),
    };
  } catch (error) {
    return {
      status: 'threw',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
