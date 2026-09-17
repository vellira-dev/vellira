import { useCallback, useRef, useState } from 'react';

import type { FloatingPlacement } from '@vellira-ui/types';
import type { RefObject } from 'react';
import type { LayoutChangeEvent, ViewInstance } from 'react-native';
import { Dimensions } from 'react-native';

import { computeFloatingPosition } from './computeFloatingPosition';
import type { FloatingPositionResult, FloatingSize } from './types';

export function useNativeFloatingPosition(
  placement: FloatingPlacement = 'top',
  offset = 8
) {
  const [isPositioned, setIsPositioned] = useState(false);
  const [result, setResult] = useState<FloatingPositionResult>({
    position: {
      top: 0,
      left: 0,
    },
    arrowPosition: {},
    placement,
  });

  const floatingSizeRef = useRef<FloatingSize>({
    width: 0,
    height: 0,
  });

  const lastTriggerRef = useRef<RefObject<ViewInstance | null> | null>(null);
  const lastContainerRef = useRef<RefObject<ViewInstance | null> | null>(null);

  const updatePosition = useCallback(
    (
      triggerRef: RefObject<ViewInstance | null>,
      containerRef?: RefObject<ViewInstance | null>,
      measuredSize = floatingSizeRef.current
    ) => {
      lastTriggerRef.current = triggerRef;
      lastContainerRef.current = containerRef ?? null;

      const triggerNode = triggerRef.current;
      const containerNode = containerRef?.current;

      if (!triggerNode || typeof triggerNode.measureInWindow !== 'function') {
        setIsPositioned(false);
        setResult((current) => ({
          ...current,
          position: {
            top: 0,
            left: 0,
          },
        }));

        return;
      }

      triggerNode.measureInWindow((x, y, width, height) => {
        const commitPosition = (
          containerX: number,
          containerY: number,
          containerWidth: number,
          containerHeight: number
        ) => {
          const nextResult = computeFloatingPosition({
            reference: {
              x: x - containerX,
              y: y - containerY,
              width,
              height,
            },
            floating: measuredSize,
            boundary: {
              width: containerWidth,
              height: containerHeight,
            },
            placement,
            offset,
          });

          setResult(nextResult);
          setIsPositioned(measuredSize.width > 0 && measuredSize.height > 0);
        };

        if (
          !containerNode ||
          typeof containerNode.measureInWindow !== 'function'
        ) {
          const window = Dimensions.get('window');

          commitPosition(0, 0, window.width, window.height);
          return;
        }

        containerNode.measureInWindow(
          (containerX, containerY, containerWidth, containerHeight) => {
            commitPosition(
              containerX,
              containerY,
              containerWidth,
              containerHeight
            );
          }
        );
      });
    },
    [placement, offset]
  );

  const onFloatingLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      const nextSize = { width, height };

      floatingSizeRef.current = nextSize;

      if (lastTriggerRef.current) {
        updatePosition(
          lastTriggerRef.current,
          lastContainerRef.current ?? undefined,
          nextSize
        );
      }
    },
    [updatePosition]
  );

  return {
    isPositioned,
    position: result.position,
    arrowPosition: result.arrowPosition,
    placement: result.placement,
    updatePosition,
    onFloatingLayout,
  };
}
