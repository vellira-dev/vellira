import type { VelliraUiUsageException } from './types';

/**
 * Architectural exceptions must identify one exact finding by path, line,
 * rule and detected control/resource. Wildcards and directory-wide suppressions
 * are intentionally unsupported.
 */
export const velliraUiUsageExceptions =
  [] as const satisfies readonly VelliraUiUsageException[];
