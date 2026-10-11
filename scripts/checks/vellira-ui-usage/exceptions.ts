import type { VelliraUiUsageException } from './types';

/**
 * Architectural exceptions must identify one exact finding by path, line,
 * rule and detected control/resource. Wildcards and directory-wide suppressions
 * are intentionally unsupported.
 */
// Permanent external-artwork composition owned by website auth (#1569).
// These exact values continue the supplied Apple surfaces and match Google's
// official boundary. Theme tokens cannot replace external brand colors. Hover,
// press and focus remain canonical Vellira resources; SVG bytes stay untouched.
export const velliraUiUsageExceptions = [
  ...(
    [
      [142, '#fff'],
      [145, '#747775'],
      [150, '#8e918f'],
      [151, '#000'],
      [156, '#8e918f'],
      [157, '#131314'],
    ] as const
  ).map(([line, detected]) => ({
    ruleId: 'vellira-ui.noncanonical-token-value' as const,
    path: 'apps/website/src/product-app/AuthSurface.module.css',
    line,
    detected,
    category: 'architectural-exception' as const,
    reason:
      'Website auth owns permanent external-brand surface composition: preserve official Apple clear space and Google reference boundary colors; see apps/website/brand/auth/README.md. Canonical Button/Tooltip and interaction tokens remain in use.',
    issue: '#1569' as const,
  })),
] satisfies readonly VelliraUiUsageException[];
