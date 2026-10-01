import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';

import type { HTMLAttributes } from 'react';

type ImageSource = number | { uri?: string } | readonly { uri?: string }[];
type ImageLoad = {
  nativeEvent: {
    source: { uri: string; width: number; height: number };
  };
};
type ImageError = { nativeEvent: { error: string } };

export type NativeImageMockProps = {
  source?: ImageSource | null;
  style?: unknown;
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: Record<string, unknown>;
  accessible?: boolean;
  importantForAccessibility?: string;
  testID?: string;
  nativeID?: string;
  onLoadStart?: () => void;
  onLoad?: (event: ImageLoad) => void;
  onError?: (event: ImageError) => void;
  onLoadEnd?: () => void;
};

export type NativeImageRequest = {
  readonly source: ImageSource;
  load: (size: { width: number; height: number; uri?: string }) => void;
  error: (message: string) => void;
};

const requests = new WeakMap<HTMLImageElement, NativeImageRequest>();

/** Capture before a source change to test a late response for the old source. */
export function captureNativeImageRequest(
  element: HTMLImageElement
): NativeImageRequest {
  const request = requests.get(element);
  if (!request) {
    throw new Error('No committed native image request for this element.');
  }
  return request;
}

/** Test-only projection: no network request and no automatic load success. */
export function createNativeImageMock(
  project: (props: NativeImageMockProps) => HTMLAttributes<HTMLImageElement>
) {
  const Image = forwardRef<HTMLImageElement, NativeImageMockProps>(
    (props, ref) => {
      const element = useRef<HTMLImageElement | null>(null);
      const mounted = useRef(false);
      const sourceKey = JSON.stringify(props.source ?? null);
      const request = useMemo(() => {
        const source = JSON.parse(sourceKey) as ImageSource | null;
        const callbacks: Pick<
          NativeImageMockProps,
          'onLoadStart' | 'onLoad' | 'onError' | 'onLoadEnd'
        > = {};
        const result: NativeImageRequest | null =
          source === null
            ? null
            : {
                source,
                load({ width, height, uri }) {
                  if (!mounted.current) return;
                  if (
                    !Number.isFinite(width) ||
                    !Number.isFinite(height) ||
                    width < 0 ||
                    height < 0
                  ) {
                    throw new Error(
                      'Native image load dimensions must be finite and nonnegative.'
                    );
                  }
                  const sourceUri =
                    typeof source === 'object' && 'uri' in source
                      ? source.uri
                      : '';
                  callbacks.onLoad?.({
                    nativeEvent: {
                      source: { uri: uri ?? sourceUri ?? '', width, height },
                    },
                  });
                  callbacks.onLoadEnd?.();
                },
                error(message) {
                  if (!mounted.current) return;
                  callbacks.onError?.({ nativeEvent: { error: message } });
                  callbacks.onLoadEnd?.();
                },
              };
        return { result, callbacks };
      }, [sourceKey]);

      useLayoutEffect(() => {
        mounted.current = true;
        return () => {
          mounted.current = false;
        };
      }, []);

      useLayoutEffect(() => {
        request.callbacks.onLoadStart = props.onLoadStart;
        request.callbacks.onLoad = props.onLoad;
        request.callbacks.onError = props.onError;
        request.callbacks.onLoadEnd = props.onLoadEnd;
      });

      useLayoutEffect(() => {
        const current = element.current;
        if (!current || !request.result) return;
        requests.set(current, request.result);
        request.callbacks.onLoadStart?.();
        return () => {
          requests.delete(current);
        };
      }, [request]);

      return (
        <img
          {...project(props)}
          ref={(current) => {
            element.current = current;
            if (typeof ref === 'function') return ref(current);
            if (ref) ref.current = current;
          }}
          alt={props.accessibilityLabel ?? ''}
          data-testid={props.testID}
          id={props.nativeID}
          data-native-source={sourceKey}
          onLoad={(event) =>
            request.result?.load({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          onError={() => request.result?.error('Native image mock load error.')}
        />
      );
    }
  );
  Image.displayName = 'Image';
  return Image;
}
