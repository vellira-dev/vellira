'use client';

import { useEffect, useState } from 'react';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../../../scripts/public-release/client';

export function PublishedNpmVersion() {
  const [release, setRelease] = useState<PublishedRelease | null>(null);

  useEffect(() => observePublicRelease(setRelease), []);

  const label = release
    ? `Latest confirmed npm version v${release.version}${
        release.stale ? ' (cached verification)' : ''
      }`
    : 'Latest confirmed npm version unavailable';

  return (
    <span aria-label={label} title={label} aria-live='polite'>
      {release ? `v${release.version}` : '—'}
    </span>
  );
}
