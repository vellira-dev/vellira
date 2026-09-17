import { useCallback, useEffect, useRef } from 'react';

import { deferOverlayFocusRestore } from '@vellira-ui/core';
import type { RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { AccessibilityInfo, findNodeHandle, Platform } from 'react-native';

export type OverlayFocusRestoreOptions = {
  active?: boolean;
  enabled?: boolean;
  finalFocus?: RefObject<ViewInstance | null>;
  triggerRef: RefObject<ViewInstance | null>;
};

type FocusableWebNode = {
  focus: () => void;
};

function isFocusableWebNode(node: unknown): node is FocusableWebNode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'focus' in node &&
    typeof node.focus === 'function'
  );
}

export const useOverlayFocusRestore = ({
  active = false,
  enabled = true,
  finalFocus,
  triggerRef,
}: OverlayFocusRestoreOptions) => {
  const previouslyFocusedRef = useRef<Element | null>(null);

  const saveFocusSnapshot = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    previouslyFocusedRef.current = document.activeElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (!enabled) return;

    if (Platform.OS === 'web') {
      const preferredNode = finalFocus?.current ?? triggerRef.current;

      if (isFocusableWebNode(preferredNode)) {
        preferredNode.focus();
        return;
      }

      const previouslyFocused = previouslyFocusedRef.current;

      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }

      return;
    }

    if (typeof findNodeHandle !== 'function') return;

    const handle = findNodeHandle(finalFocus?.current ?? triggerRef.current);

    if (handle && AccessibilityInfo.setAccessibilityFocus) {
      AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, [enabled, finalFocus, triggerRef]);

  const restoreFocusAfterClose = useCallback(() => {
    if (!enabled) return;

    deferOverlayFocusRestore(restoreFocus, requestAnimationFrame);
  }, [enabled, restoreFocus]);

  useEffect(() => {
    if (!active) return;

    saveFocusSnapshot();
  }, [active, saveFocusSnapshot]);

  return {
    restoreFocus,
    restoreFocusAfterClose,
    saveFocusSnapshot,
  };
};
