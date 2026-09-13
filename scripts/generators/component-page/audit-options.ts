/**
 * Default CI audits the complete discovered inventory. A focused invocation
 * selects per-component work only; shared registry validation still runs.
 */
export function selectComponentPageAuditComponents(
  args: readonly string[],
  available: readonly string[]
): string[] {
  if (available.length === 0) {
    throw new Error('No generated component pages were found to audit.');
  }
  if (args.length === 0) return [...available];

  const componentName = args[1];
  if (
    args.length !== 2 ||
    args[0] !== '--component' ||
    !componentName ||
    componentName.startsWith('--')
  ) {
    throw new Error('Usage: component-pages:audit [--component <Name>].');
  }
  if (!available.includes(componentName)) {
    throw new Error(
      `Unknown generated component "${componentName}". Expected one of: ${available.join(', ')}.`
    );
  }
  return [componentName];
}
