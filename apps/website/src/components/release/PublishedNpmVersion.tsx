'use client';

import { useEffect, useState } from 'react';

import {
  observePublicRelease,
  type PublishedRelease,
} from '../../../../../scripts/public-release/client';

export function PublishedNpmVersion() {
  const [release, setRelease] = useState<PublishedRelease | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(
    () =>
      observePublicRelease(
        (next) => {
          setRelease(next);
          setChecked(true);
        },
        { url: '/api/public-release' }
      ),
    []
  );

  const label = release
    ? `Latest confirmed npm version v${release.version}${
        release.stale ? ' (cached verification)' : ''
      }`
    : checked
      ? 'Latest confirmed npm version unavailable'
      : 'Checking latest confirmed npm version';

  const state = release ? 'verified' : checked ? 'unavailable' : 'loading';

  return (
    <span
      aria-label={label}
      title={label}
      aria-live='polite'
      data-release-state={state}
    >
      {release ? `v${release.version}` : checked ? 'Unavailable' : 'Checking…'}
    </span>
  );
}
