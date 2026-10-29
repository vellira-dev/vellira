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

export type ProjectEditorFields = {
  name: string;
  description: string;
  team: string;
  status: string;
};

/**
 * Creation requires a non-blank name and valid required selectors.
 * Editing also requires a real persisted change, not whitespace-only edits.
 * A missing original record must never create a misleading successful save.
 */
export function canSubmitProjectEditor(
  draft: ProjectEditorFields,
  original?: ProjectEditorFields | null
): boolean {
  const name = draft.name.trim();
  if (
    !name ||
    !['design', 'platform', 'mobile'].includes(draft.team) ||
    !['planned', 'active', 'shipped'].includes(draft.status)
  ) {
    return false;
  }
  if (original === undefined) return true;
  if (original === null) return false;

  return (
    name !== original.name.trim() ||
    draft.description.trim() !== original.description.trim() ||
    draft.team !== original.team ||
    draft.status !== original.status
  );
}
