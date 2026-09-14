import { createHash } from 'node:crypto';
import { COMPONENT_TOKEN_REGISTRY } from '../component-production/production-eligibility';
import {
  parseComponentProductionSeed,
  type ComponentProductionSeedV1,
} from '../component-production/production-seed';
import { parseCanonicalGapRequest, type CanonicalGapRequestV1 } from './types';

/** One governance work item per exact component family, independent of discovery path. */
export function componentTokenReservationRequest(
  seed: ComponentProductionSeedV1,
  consumer: string,
  launchCritical = false
): CanonicalGapRequestV1 {
  seed = parseComponentProductionSeed(seed);
  if (seed.componentTokens === false)
    throw new Error('Tokenless component cannot request reservation.');
  const digest = createHash('sha256')
    .update(`vellira-component-token-reservation-v1:${seed.componentName}`)
    .digest('hex')
    .slice(0, 20);
  return parseCanonicalGapRequest({
    schemaVersion: '1',
    requestId: `component-token-reservation-${digest}`,
    kind: 'component-token-reservation',
    canonicalTarget: seed.componentName,
    requestedIntent: `Reserve ${seed.componentName} with status=reserved, public=true and owner=${seed.componentName} in ${COMPONENT_TOKEN_REGISTRY} before Component Production.`,
    consumer,
    launchCritical,
    productionSeed: seed,
    reservation: {
      requiredState: 'reserved',
      registryPath: COMPONENT_TOKEN_REGISTRY,
    },
  });
}
