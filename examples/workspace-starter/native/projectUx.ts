/** Pure project UX helpers shared by the Native Starter and regression tests. */
export function hasActiveProjectFilters(
  searchVisible: boolean,
  searchQuery: string,
  statusFilter: string
): boolean {
  return (
    statusFilter !== 'all' || (searchVisible && searchQuery.trim().length > 0)
  );
}

/** Generate a non-colliding copy name even when duplicating an existing copy. */
export function nextUniqueDuplicateName(
  sourceName: string,
  existingNames: readonly string[]
): string {
  const trimmed = sourceName.trim();
  const base =
    trimmed.replace(/(?: copy(?: \d+)?)+$/i, '').trimEnd() ||
    'Untitled project';
  const preferred = base + ' copy';
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  if (!taken.has(preferred.toLowerCase())) return preferred;

  let suffix = 2;
  while (taken.has((preferred + ' ' + suffix).toLowerCase())) suffix += 1;
  return preferred + ' ' + suffix;
}
