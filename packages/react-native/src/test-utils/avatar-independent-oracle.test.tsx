import { act, useState } from 'react';

import { Image, Text, View } from 'react-native';
import { describe, expect, it } from 'vitest';

import { captureNativeImageRequest } from '../../test/native-image.mock';

import { render } from './render';

// This is an independent *oracle calibration*, not a candidate implementation.
// #1523 remains a frozen historical Draft; a future approved successor must be
// run through these same assertions. A mock cannot prove device/OS pixels or AT.
type ReviewProps = {
  name: string;
  fallback: string;
  source?: number | string;
  size?: 'sm' | 'md' | 'lg';
};

type Mutation =
  | 'none'
  | 'stale-request'
  | 'missing-truncation'
  | 'lost-error'
  | 'duplicate-name';

function makeFixture(mutation: Mutation) {
  function ImageState({
    fallback,
    name,
    source,
  }: {
    fallback: string;
    name: string;
    source: number | { uri: string };
  }) {
    const [loaded, setLoaded] = useState(false);

    return (
      <>
        {!loaded && (
          <Text
            accessible={false}
            ellipsizeMode='tail'
            numberOfLines={mutation === 'missing-truncation' ? undefined : 1}
            testID='avatar-review-fallback'
          >
            {fallback}
          </Text>
        )}
        <Image
          accessible={mutation === 'duplicate-name'}
          accessibilityLabel={mutation === 'duplicate-name' ? name : undefined}
          source={source}
          onLoad={() => setLoaded(true)}
          onError={
            mutation === 'lost-error' ? undefined : () => setLoaded(false)
          }
        />
      </>
    );
  }

  function Fixture({ fallback, name, size = 'md', source }: ReviewProps) {
    const dimensions = { sm: 24, md: 32, lg: 40 };
    const normalizedSource =
      typeof source === 'string' ? { uri: source } : source;
    const sourceKey =
      typeof source === 'string' ? 'uri:' + source : 'asset:' + String(source);

    return (
      <View
        accessibilityRole='image'
        accessibilityLabel={name}
        style={{
          width: dimensions[size],
          height: dimensions[size],
          overflow: 'hidden',
        }}
      >
        {normalizedSource ? (
          <ImageState
            key={mutation === 'stale-request' ? 'reused-image' : sourceKey}
            fallback={fallback}
            name={name}
            source={normalizedSource}
          />
        ) : (
          <Text
            accessible={false}
            ellipsizeMode='tail'
            numberOfLines={mutation === 'missing-truncation' ? undefined : 1}
            testID='avatar-review-fallback'
          >
            {fallback}
          </Text>
        )}
      </View>
    );
  }

  return Fixture;
}

function inspectCandidate(Candidate: ReturnType<typeof makeFixture>) {
  const required = {
    name: 'Jordan Diaz',
    fallback: 'Jordan Alexander Diaz Smith',
    size: 'sm' as const,
  };
  const mounted = render(<Candidate {...required} />);
  const fallback = () =>
    mounted.container.querySelector<HTMLElement>(
      '[data-testid="avatar-review-fallback"]'
    );
  const image = () => {
    const img = mounted.container.querySelector<HTMLImageElement>('img');
    if (!img) throw new Error('The current source has no image request');
    return img;
  };

  try {
    // No source: a single accessible root and a centered, single-line,
    // truncating fallback. The native mock exposes declarative line policy.
    const root = mounted.container.querySelector<HTMLElement>('[role="img"]');
    expect(root?.getAttribute('aria-label')).toBe(required.name);
    expect(root?.style.width).toBe('24px');
    expect(root?.style.height).toBe('24px');
    expect(fallback()?.textContent).toBe(required.fallback);
    expect(fallback()?.dataset.numberOfLines).toBe('1');
    expect(fallback()?.dataset.ellipsizeMode).toBe('tail');
    expect(fallback()?.getAttribute('aria-hidden')).toBe('true');

    mounted.rerender(<Candidate {...required} source='profile-a' />);
    expect(fallback()?.textContent).toBe(required.fallback);
    expect(image().getAttribute('aria-hidden')).toBe('true');
    expect(
      mounted.container.querySelectorAll(
        '[role="img"]:not([aria-hidden="true"])'
      )
    ).toHaveLength(1);

    const a = captureNativeImageRequest(image());
    act(() => a.error('404'));
    expect(fallback()?.textContent).toBe(required.fallback);

    mounted.rerender(<Candidate {...required} source='profile-b' />);
    const b = captureNativeImageRequest(image());
    expect(fallback()?.textContent).toBe(required.fallback);

    // A retained callback from the old source must not settle B's state.
    act(() => a.load({ width: 24, height: 24 }));
    expect(fallback()?.textContent).toBe(required.fallback);
    act(() => b.load({ width: 24, height: 24 }));
    expect(fallback()).toBeNull();

    // A failure of the current, previously successful source restores fallback.
    act(() => b.error('decode failure'));
    expect(fallback()?.textContent).toBe(required.fallback);

    mounted.rerender(<Candidate {...required} source={42} size='lg' />);
    expect(captureNativeImageRequest(image()).source).toBe(42);
    expect(
      mounted.container.querySelector<HTMLElement>('[role="img"]')?.style.width
    ).toBe('40px');
    expect(fallback()?.textContent).toBe(required.fallback);

    mounted.rerender(<Candidate {...required} source={undefined} />);
    expect(fallback()?.textContent).toBe(required.fallback);
  } finally {
    mounted.unmount();
  }
}

describe('Avatar V2 native request oracle calibration', () => {
  it('accepts the reference lifecycle', () => {
    expect(() => inspectCandidate(makeFixture('none'))).not.toThrow();
  });

  it('detects old A response erroneously loading current B', () => {
    expect(() => inspectCandidate(makeFixture('stale-request'))).toThrow();
  });

  it('detects a fallback that permits multiline overflow', () => {
    expect(() => inspectCandidate(makeFixture('missing-truncation'))).toThrow();
  });

  it('detects an image with a duplicate accessible name', () => {
    expect(() => inspectCandidate(makeFixture('duplicate-name'))).toThrow();
  });

  it('detects failure to restore fallback after a current-image error', () => {
    expect(() => inspectCandidate(makeFixture('lost-error'))).toThrow();
  });
});
