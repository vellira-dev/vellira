import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import type { AriaAttributes } from 'react';

type PressableState = { pressed: boolean; hovered: boolean; focused: boolean };

type NativeProps = {
  children?: React.ReactNode | ((state: PressableState) => React.ReactNode);
  style?: unknown;
  disabled?: boolean;
  accessibilityRole?: string;
  accessibilityState?: Record<string, unknown>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityLabelledBy?: string;
  'aria-describedby'?: string;
  accessibilityLiveRegion?: string;
  ellipsizeMode?: string;
  accessible?: boolean;
  importantForAccessibility?: string;
  numberOfLines?: number;
  nativeID?: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onLongPress?: () => void;
  onChangeText?: (value: string) => void;
  onRequestClose?: () => void;
  value?: string;
  defaultValue?: string;
  multiline?: boolean;
  editable?: boolean;
  placeholder?: string;
  maxLength?: number;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  keyboardType?: string;
  returnKeyType?: string;
  autoFocus?: boolean;
  keyboardShouldPersistTaps?: string;
  contentContainerStyle?: unknown;
  testID?: string;
  color?: string;
  size?: string | number;
  onLayout?: (event: {
    nativeEvent: {
      layout: { width: number; height: number; x: number; y: number };
    };
  }) => void;
};

const flattenStyle = (style: unknown): React.CSSProperties | undefined => {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle).filter(Boolean));
  }
  if (typeof style === 'object') return style as React.CSSProperties;
  return undefined;
};

const roleFromAccessibility = (role?: string) => {
  if (role === 'button') return 'button';
  if (role === 'checkbox') return 'checkbox';
  if (role === 'radio') return 'radio';
  if (role === 'radiogroup') return 'radiogroup';
  if (role === 'tab') return 'tab';
  if (role === 'tablist') return 'tablist';
  if (role === 'toolbar') return 'toolbar';
  if (role === 'header') return 'heading';
  if (role === 'menu') return 'menu';
  if (role === 'menuitem') return 'menuitem';
  return undefined;
};

const stateProps = (state?: Record<string, unknown>): AriaAttributes => ({
  'aria-checked':
    typeof state?.checked === 'boolean' || state?.checked === 'mixed'
      ? state.checked
      : undefined,
  'aria-disabled':
    typeof state?.disabled === 'boolean' ? state.disabled : undefined,
  'aria-expanded':
    typeof state?.expanded === 'boolean' ? state.expanded : undefined,
  'aria-selected':
    typeof state?.selected === 'boolean' ? state.selected : undefined,
  'aria-busy': typeof state?.busy === 'boolean' ? state.busy : undefined,
});

const renderChildren = (
  children: NativeProps['children'],
  state: PressableState
): React.ReactNode =>
  typeof children === 'function' ? children(state) : children;

const ariaLive = (value?: string): AriaAttributes['aria-live'] =>
  value === 'polite' || value === 'assertive' ? value : undefined;

const accessibilityProps = ({
  accessibilityLabel,
  accessibilityHint,
  accessibilityLabelledBy,
  'aria-describedby': ariaDescribedBy,
  accessibilityLiveRegion,
  accessible,
  importantForAccessibility,
}: Partial<
  Pick<
    NativeProps,
    | 'accessibilityLabel'
    | 'accessibilityHint'
    | 'accessibilityLabelledBy'
    | 'aria-describedby'
    | 'accessibilityLiveRegion'
    | 'accessible'
    | 'importantForAccessibility'
  >
>) => ({
  'aria-label': accessibilityLabel,
  'aria-description': accessibilityHint,
  'aria-labelledby': accessibilityLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-hidden':
    accessible === false || importantForAccessibility === 'no'
      ? true
      : undefined,
  'aria-live': ariaLive(accessibilityLiveRegion),
  'data-important-for-accessibility': importantForAccessibility,
});

export const View = forwardRef<HTMLDivElement, NativeProps>(
  (
    {
      children,
      style,
      accessibilityRole,
      accessibilityState,
      accessibilityLabel,
      accessibilityHint,
      accessibilityLabelledBy,
      accessibilityLiveRegion,
      accessible,
      importantForAccessibility,
      testID,
      nativeID,
      onLayout,
    },
    ref
  ) => {
    const resolvedStyle = flattenStyle(style);
    const onLayoutRef = useRef(onLayout);

    useEffect(() => {
      onLayoutRef.current = onLayout;
    }, [onLayout]);

    useEffect(() => {
      onLayoutRef.current?.({
        nativeEvent: {
          layout: {
            width: Number(resolvedStyle?.width ?? resolvedStyle?.maxWidth ?? 0),
            height: Number(resolvedStyle?.height ?? 0),
            x: 0,
            y: 0,
          },
        },
      });
    }, [resolvedStyle?.height, resolvedStyle?.maxWidth, resolvedStyle?.width]);

    return (
      <div
        ref={ref}
        data-testid={testID}
        id={nativeID}
        role={roleFromAccessibility(accessibilityRole)}
        style={resolvedStyle}
        {...stateProps(accessibilityState)}
        {...accessibilityProps({
          accessibilityLabel,
          accessibilityHint,
          accessibilityLabelledBy,
          accessibilityLiveRegion,
          accessible,
          importantForAccessibility,
        })}
      >
        {renderChildren(children, {
          pressed: false,
          hovered: false,
          focused: false,
        })}
      </div>
    );
  }
);
View.displayName = 'View';

export const Animated = {
  Value: class {
    value: number;

    constructor(value: number) {
      this.value = value;
    }

    setValue(value: number) {
      this.value = value;
    }

    interpolate({ outputRange }: { outputRange: Array<number | string> }) {
      return outputRange[this.value >= 1 ? outputRange.length - 1 : 0];
    }
  },

  timing: () => ({
    start: () => {},
  }),

  View,
};

export const Text = forwardRef<HTMLSpanElement, NativeProps>(
  (
    {
      children,
      style,
      testID,
      accessibilityRole,
      accessibilityLabel,
      accessibilityHint,
      accessibilityLiveRegion,
      ellipsizeMode,
      accessible,
      importantForAccessibility,
      numberOfLines,
    },
    ref
  ) => (
    <span
      ref={ref}
      data-testid={testID}
      data-ellipsize-mode={ellipsizeMode}
      data-number-of-lines={numberOfLines}
      role={roleFromAccessibility(accessibilityRole)}
      style={flattenStyle(style)}
      {...accessibilityProps({
        accessibilityLabel,
        accessibilityHint,
        accessibilityLiveRegion,
        accessible,
        importantForAccessibility,
      })}
    >
      {renderChildren(children, {
        pressed: false,
        hovered: false,
        focused: false,
      })}
    </span>
  )
);
Text.displayName = 'Text';

export const ActivityIndicator = ({ color, size, testID }: NativeProps) => (
  <span
    data-testid={testID ?? 'activity-indicator'}
    role='progressbar'
    style={{ color }}
  >
    {size}
  </span>
);

export const Pressable = forwardRef<HTMLButtonElement, NativeProps>(
  (
    {
      children,
      style,
      disabled,
      accessibilityRole,
      accessibilityState,
      accessibilityLabel,
      accessibilityHint,
      accessibilityLabelledBy,
      'aria-describedby': ariaDescribedBy,
      onPress,
      onPressIn,
      onPressOut,
      onHoverIn,
      onHoverOut,
      onFocus,
      onBlur,
      onLongPress,
      testID,
      nativeID,
    },
    ref
  ) => {
    const state: PressableState = {
      pressed: false,
      hovered: false,
      focused: false,
    };

    const resolvedStyle = typeof style === 'function' ? style(state) : style;

    const resolvedChildren =
      typeof children === 'function' ? children(state) : children;

    return (
      <button
        ref={ref}
        type='button'
        data-testid={testID}
        id={nativeID}
        disabled={disabled}
        role={roleFromAccessibility(accessibilityRole)}
        style={flattenStyle(resolvedStyle)}
        onClick={onPress}
        onFocus={onFocus}
        onBlur={onBlur}
        onMouseEnter={onHoverIn}
        onMouseLeave={onHoverOut}
        onMouseDown={onPressIn}
        onMouseUp={onPressOut}
        onDoubleClick={onLongPress}
        {...stateProps(accessibilityState)}
        {...accessibilityProps({
          accessibilityLabel,
          accessibilityHint,
          accessibilityLabelledBy,
          'aria-describedby': ariaDescribedBy,
        })}
      >
        {resolvedChildren}
      </button>
    );
  }
);
Pressable.displayName = 'Pressable';

export const TextInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  NativeProps
>(
  (
    {
      value,
      defaultValue,
      multiline = false,
      numberOfLines,
      placeholder,
      maxLength,
      editable = true,
      secureTextEntry,
      keyboardType,
      returnKeyType,
      autoFocus,
      onChangeText,
      onFocus,
      onBlur,
      style,
      testID,
      nativeID,
      accessibilityLabel,
      accessibilityHint,
      accessibilityLabelledBy,
      'aria-describedby': ariaDescribedBy,
      accessibilityState,
    },
    ref
  ) => {
    const sharedProps = {
      'data-testid': testID,
      id: nativeID,
      'data-keyboard-type': keyboardType,
      'data-return-key-type': returnKeyType,
      'data-auto-focus': autoFocus ? 'true' : undefined,
      'aria-label': accessibilityLabel,
      'aria-description': accessibilityHint,
      'aria-labelledby': accessibilityLabelledBy,
      'aria-describedby': ariaDescribedBy,
      placeholder,
      maxLength,
      disabled: !editable,
      autoFocus,
      style: flattenStyle(style),
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => onChangeText?.(event.currentTarget.value),
      onFocus,
      onBlur,
      ...stateProps(accessibilityState),
    };

    if (multiline) {
      return (
        <textarea
          {...sharedProps}
          ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
          data-multiline='true'
          data-number-of-lines={numberOfLines}
          rows={numberOfLines}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
        />
      );
    }

    return (
      <input
        {...sharedProps}
        ref={ref as React.ForwardedRef<HTMLInputElement>}
        value={value ?? ''}
        type={secureTextEntry ? 'password' : 'text'}
        inputMode={keyboardType === 'numeric' ? 'numeric' : undefined}
      />
    );
  }
);
TextInput.displayName = 'TextInput';

type FlatListHandle = {
  scrollToIndex: (params: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
  }) => void;
  scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
};

type FlatListProps<T> = NativeProps & {
  data?: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  getItemLayout?: (
    data: ArrayLike<T> | null | undefined,
    index: number
  ) => { length: number; offset: number; index: number };
  initialScrollIndex?: number;
  onScrollToIndexFailed?: (info: { index: number }) => void;
};

const FlatListComponent = forwardRef<FlatListHandle, FlatListProps<unknown>>(
  function FlatListComponent(
    {
      data,
      renderItem,
      keyExtractor,
      style,
      contentContainerStyle,
      testID,
      onLayout,
      initialScrollIndex,
      getItemLayout,
    }: FlatListProps<unknown>,
    ref
  ) {
    const [scrolledIndex, setScrolledIndex] = useState<number | undefined>();
    const [scrolledOffset, setScrolledOffset] = useState<number | undefined>();
    const [scrollViewPosition, setScrollViewPosition] = useState<
      number | undefined
    >();

    const resolvedStyle = flattenStyle(style);
    const initialLayout =
      typeof initialScrollIndex === 'number'
        ? getItemLayout?.(data, initialScrollIndex)
        : undefined;

    useEffect(() => {
      onLayout?.({
        nativeEvent: {
          layout: {
            width: Number(resolvedStyle?.width ?? 0),
            height: Number(
              resolvedStyle?.height ?? resolvedStyle?.maxHeight ?? 0
            ),
            x: 0,
            y: 0,
          },
        },
      });
    }, [
      onLayout,
      resolvedStyle?.height,
      resolvedStyle?.maxHeight,
      resolvedStyle?.width,
    ]);

    useImperativeHandle(ref, () => ({
      scrollToIndex: ({ index, viewPosition }) => {
        setScrolledIndex(index);
        setScrollViewPosition(viewPosition);
      },
      scrollToOffset: ({ offset }) => {
        setScrolledOffset(offset);
      },
    }));

    return (
      <div
        data-testid={testID ?? 'native-flat-list'}
        data-initial-scroll-index={initialScrollIndex}
        data-initial-scroll-offset={initialLayout?.offset}
        data-initial-scroll-length={initialLayout?.length}
        data-scroll-to-index={scrolledIndex}
        data-scroll-to-offset={scrolledOffset}
        data-scroll-view-position={scrollViewPosition}
        data-keyboard-should-persist-taps={undefined}
        style={resolvedStyle}
      >
        <div style={flattenStyle(contentContainerStyle)}>
          {(data ?? []).map((item, index) => (
            <React.Fragment key={keyExtractor?.(item, index) ?? index}>
              {renderItem({ item, index })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }
);
FlatListComponent.displayName = 'FlatList';

export const FlatList = FlatListComponent as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatListHandle> }
) => React.ReactElement;

export const Modal = ({
  visible,
  children,
}: NativeProps & { visible?: boolean }) => {
  if (!visible) return null;
  return (
    <div data-testid='native-modal'>
      {renderChildren(children, {
        pressed: false,
        hovered: false,
        focused: false,
      })}
    </div>
  );
};

export const StyleSheet = {
  create<T extends Record<string, unknown>>(styles: T): T {
    return styles;
  },

  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};

export const Platform = {
  OS: 'web',
  select<T>(specifics: { web?: T; default?: T }): T | undefined {
    return specifics.web ?? specifics.default;
  },
};

export const Dimensions = {
  get() {
    return { width: 1024, height: 768 };
  },
};

export const useWindowDimensions = () => Dimensions.get();

export const AccessibilityInfo = {
  announceForAccessibility: () => undefined,
  setAccessibilityFocus: () => undefined,
};
