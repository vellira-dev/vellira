import { useState } from 'react';

import type { AvatarProps } from './types';

import styles from './Avatar.module.scss';

export function Avatar({ fallback, name, size = 'md', source }: AvatarProps) {
  return (
    <div
      className={`${styles.avatar} ${styles[size]}`}
      role='img'
      aria-label={name}
    >
      {source ? (
        <AvatarImage key={source} fallback={fallback} source={source} />
      ) : (
        <span className={styles.fallback} aria-hidden='true'>
          {fallback}
        </span>
      )}
    </div>
  );
}

type AvatarImageProps = {
  fallback: string;
  source: string;
};

function AvatarImage({ fallback, source }: AvatarImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <span className={styles.fallback} aria-hidden='true'>
          {fallback}
        </span>
      )}
      <img
        className={styles.image}
        src={source}
        alt=''
        aria-hidden='true'
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </>
  );
}
