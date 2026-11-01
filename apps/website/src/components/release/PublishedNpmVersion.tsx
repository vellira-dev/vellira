'use client';

import { useEffect, useState } from 'react';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../../../scripts/public-release/client';

export function PublishedNpmVersion({
  release: providedRelease,
}: { release?: PublishedRelease | null } = {}) {
  const [observedRelease, setRelease] = useState<PublishedRelease | null>(null);

  useEffect(() => {
    if (providedRelease !== undefined) return;
    return observePublicRelease(setRelease, { url: '/api/public-release' });
  }, [providedRelease]);

  const release =
    providedRelease === undefined ? observedRelease : providedRelease;
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
