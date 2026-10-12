'use client';

import { useEffect, useState } from 'react';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../../../scripts/public-release/client';

export function PublishedNpmVersion() {
  const [release, setRelease] = useState<PublishedRelease | null>(null);

  useEffect(
    () => observePublicRelease(setRelease, { url: '/api/public-release' }),
    []
  );

  if (!release) return null;

  const label = `Latest confirmed npm version v${release.version}${
    release.stale ? ' (cached verification)' : ''
  }`;

  return (
    <span aria-label={label} title={label} aria-live='polite'>
      {`v${release.version}`}
    </span>
  );
}
