import type { VelliraUiUsageException } from './types';

/**
 * Architectural exceptions must identify one exact finding by path, line,
 * rule and detected control/resource. Wildcards and directory-wide suppressions
 * are intentionally unsupported.
 */
export const velliraUiUsageExceptions = [
  {
    ruleId: 'vellira-ui.existing-component-bypass',
    path: 'apps/website/src/blog/ui/BlogNewsletterSignup.tsx',
    line: 38,
    detected: 'input',
    category: 'architectural-exception',
    reason:
      'Zero-JS RSC boundary requires native input; importing the client-backed Input breaks the production server build.',
    issue: '#1236',
  },
  {
    ruleId: 'vellira-ui.existing-component-bypass',
    path: 'apps/website/src/blog/ui/BlogNewsletterSignup.tsx',
    line: 48,
    detected: 'button',
    category: 'architectural-exception',
    reason:
      'Zero-JS RSC boundary requires native button; importing the client-backed Button breaks the production server build.',
    issue: '#1236',
  },
] as const satisfies readonly VelliraUiUsageException[];
