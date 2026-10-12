/** Public readonly typing for the fail-closed JavaScript preflight module. */
export declare class BridgePreflightError extends Error {}

export interface BridgePreflightResult {
  schemaVersion: 1;
  status: 'read_only_verified';
  sourceRepository: 'vellira-dev/vellira';
  productionRunId: number;
  productionRunAttempt: number;
  deployedCandidateSha: string;
  buildId: string;
  canonicalUrl: string;
  workflowCheckoutShaDiffers: boolean;
  externalPublishingAuthorized: false;
  humanApprovalGranted: false;
  repositoryDispatchSent: false;
  containsCredentials: false;
}

/**
 * Data is verified at runtime. Keep the boundary typed as untrusted input.
 * Successful validation grants no notification or publishing authority.
 */
export declare function validateBridgePreflight(
  input: unknown
): BridgePreflightResult;
