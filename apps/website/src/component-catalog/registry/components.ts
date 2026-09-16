import { componentMetadata } from '@vellira-ui/metadata';

import { componentCatalogPresentation } from './componentPresentation';
import { deriveComponentCatalogEntries } from './deriveComponentCatalogEntries';

export const webComponents = deriveComponentCatalogEntries(
  componentCatalogPresentation,
  componentMetadata
);
