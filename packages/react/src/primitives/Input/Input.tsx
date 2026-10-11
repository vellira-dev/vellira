import { forwardRef, useCallback, useId, useRef, useState } from 'react';

import { Close, Eye, EyeOff, Search } from '@vellira-ui/icons';
import { controlSizes } from '@vellira-ui/tokens';
import type { ChangeEvent, CSSProperties, InputHTMLAttributes } from 'react';

import type { InputProps } from './types';

import styles from './Input.module.scss';

import { FormField, useFormFieldContext } from '#patterns/FormField';
import { cn } from '#utils/cn';

const toneClassNameByTone = {
  default: styles.toneDefault,
  primary: styles.tonePrimary,
  secondary: styles.toneSecondary,
  success: styles.toneSuccess,
  danger: styles.toneDanger,
  muted: styles.toneMuted,
  inverse: styles.toneInverse,
} as const;

type InputSizeStyle = CSSProperties & {
  '--input-height': string;
  '--input-font-size': string;
  '--input-line-height': string;
  '--input-icon-size': string;
};

const getAutoComplete = (
  type: InputHTMLAttributes<HTMLInputElement>['type'] = 'text',
  autoComplete?: string
) => {
  if (autoComplete) return autoComplete;

  switch (type) {
    case 'email':
      return 'email';
    case 'password':
      return 'current-password';
    case 'tel':
      return 'tel';
    case 'url':
      return 'url';
    case 'search':
      return 'off';
    default:
      return undefined;
  }
};

const applyPatternMask = (value: string, pattern: string) => {
  const digits = value.replace(/\D/g, '');
  let digitIndex = 0;
  let maskedValue = '';

  for (const character of pattern) {
    if (character === '#') {
      const nextDigit = digits[digitIndex];

      if (!nextDigit) break;

      maskedValue += nextDigit;
      digitIndex += 1;
      continue;
    }

    if (digitIndex < digits.length) {
      maskedValue += character;
    }
  }

  return maskedValue;
};

const applyMask = (value: string, mask: InputProps['mask']) => {
  if (!mask) return value;

  return typeof mask === 'function'
    ? mask(value)
    : applyPatternMask(value, mask);
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id: providedId,
      label,
      name,
      description,
      placeholder,
      value,
      defaultValue,
      type = 'text',
      size,
      color = 'primary',
      variant = 'outline',
      error,
      invalid = false,
      disabled = false,
      required = false,
      loading = false,
      className,
      style,
      wrapperClassName,
      autoComplete,
      readOnly = false,
      clearable = false,
      onClear,
      onValueChange,
      revealPassword = false,
      showCounter: showCounterProp = false,
      startIcon,
      endIcon,
      startAddon,
      endAddon,
      prefix,
      suffix,
      clearIcon,
      mask,
      format,
      parse,
      startIconTone = 'default',
      endIconTone = 'default',
      clearIconTone = 'danger',
      autoFocus,
      maxLength,
      onMouseEnter,
      onMouseLeave,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      'aria-labelledby': ariaLabelledBy,
      ...inputProps
    },
    ref
  ) => {
    const generatedId = useId();
    const field = useFormFieldContext();
    const hasOwnField = Boolean(label || description || error);
    const id =
      providedId ??
      (!hasOwnField ? field?.controlId : undefined) ??
      generatedId;

    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isPasswordRevealed, setIsPasswordRevealed] = useState(false);

    const [uncontrolledValue, setUncontrolledValue] = useState(
      defaultValue ?? ''
    );

    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : uncontrolledValue;
    const currentValueText = String(currentValue ?? '');
    const displayValue = format ? format(currentValueText) : currentValueText;
    const hasValue = currentValueText.length > 0;
    const resolvedSize = size ?? field?.size ?? 'md';
    const controlSize = controlSizes[resolvedSize];
    const sizeStyle: InputSizeStyle = {
      '--input-height': `${controlSize.height}px`,
      '--input-font-size': `${controlSize.fontSize}px`,
      '--input-line-height': `${controlSize.lineHeight}px`,
      '--input-icon-size': `${controlSize.iconSize}px`,
    };
    const isInvalid =
      invalid || Boolean(error) || (!hasOwnField && Boolean(field?.invalid));
    const isDisabled = disabled || (!hasOwnField && Boolean(field?.disabled));
    const isRequired = required || (!hasOwnField && Boolean(field?.required));
    const isReadOnly = readOnly || loading;
    const isPasswordInput = type === 'password';
    const resolvedType =
      isPasswordInput && revealPassword && isPasswordRevealed ? 'text' : type;
    const resolvedStartIcon =
      startIcon ?? (type === 'search' ? <Search /> : null);
    const resolvedEndIcon = endIcon;

    const resolvedAutoComplete = getAutoComplete(type, autoComplete);
    const showLoading = loading && !isDisabled;
    const showClearButton =
      clearable && hasValue && !isDisabled && !isReadOnly && !showLoading;
    const showRevealButton =
      revealPassword &&
      isPasswordInput &&
      !isDisabled &&
      !showLoading &&
      !showClearButton;
    const showEndIcon =
      !showLoading &&
      !showClearButton &&
      !showRevealButton &&
      Boolean(resolvedEndIcon);
    const shouldShowCounter = Boolean(showCounterProp && maxLength);
    const descriptionId = description ? `${id}-description` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const counterId = shouldShowCounter ? `${id}-counter` : undefined;
    const describedBy = [
      ariaDescribedBy,
      !hasOwnField && !ariaDescribedBy ? field?.ariaDescribedBy : undefined,
      descriptionId,
      errorId,
      counterId,
    ]
      .filter(Boolean)
      .join(' ');

    const clearIconNode = clearIcon ?? <Close aria-hidden='true' />;
    const hasStartContent = Boolean(resolvedStartIcon || prefix);
    const hasEndContent = Boolean(
      resolvedEndIcon ||
      suffix ||
      showClearButton ||
      showRevealButton ||
      showLoading
    );
    const hasStartIconAndPrefix = Boolean(resolvedStartIcon && prefix);
    const hasEndIconAndSuffix = Boolean(resolvedEndIcon && suffix);
    const hasAddons = Boolean(startAddon || endAddon);

    const setRefs = useCallback(
      (element: HTMLInputElement | null) => {
        inputRef.current = element;

        if (typeof ref === 'function') {
          ref(element);
          return;
        }

        if (ref) {
          ref.current = element;
        }
      },
      [ref]
    );

    const handleChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const parsedValue = parse
          ? parse(event.target.value)
          : event.target.value;
        const nextValue = applyMask(parsedValue, mask);

        if (!isControlled) {
          setUncontrolledValue(nextValue);
        }

        onValueChange?.(nextValue);
      },
      [isControlled, mask, onValueChange, parse]
    );

    const handleClear = useCallback(() => {
      if (!isControlled) {
        setUncontrolledValue('');
      }

      onValueChange?.('');
      onClear?.();
      inputRef.current?.focus();
    }, [isControlled, onClear, onValueChange]);

    const control = (
      <>
        <div
          className={cn(styles.inputGroup, styles[variant], styles[color], {
            [styles.hasAddons]: hasAddons,
            [styles.isDisabled]: isDisabled,
            [styles.isInvalid]: isInvalid,
            [styles.isLoading]: showLoading,
          })}
        >
          {startAddon && <span className={styles.addon}>{startAddon}</span>}

          <div
            className={cn(styles.inputWrapper, {
              [styles.hasLeftAdornment]: hasStartContent,
              [styles.hasRightAdornment]: hasEndContent,
              [styles.hasStartIconAndPrefix]: hasStartIconAndPrefix,
              [styles.hasEndIconAndSuffix]: hasEndIconAndSuffix,
            })}
          >
            {resolvedStartIcon && (
              <span
                aria-hidden='true'
                className={cn(
                  styles.startAdornment,
                  toneClassNameByTone[startIconTone]
                )}
              >
                {resolvedStartIcon}
              </span>
            )}

            {prefix && <span className={styles.prefix}>{prefix}</span>}

            <input
              {...inputProps}
              ref={setRefs}
              id={id}
              name={name}
              type={resolvedType}
              autoComplete={resolvedAutoComplete}
              className={cn(
                styles.input,
                styles[resolvedSize],
                {
                  [styles.error]: isInvalid,
                },
                className
              )}
              style={{
                ...sizeStyle,
                ...style,
              }}
              value={displayValue}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={isDisabled}
              readOnly={isReadOnly}
              required={isRequired}
              autoFocus={autoFocus}
              maxLength={maxLength}
              aria-invalid={isInvalid ? true : ariaInvalid}
              aria-labelledby={
                ariaLabelledBy ??
                (!hasOwnField ? field?.ariaLabelledBy : undefined)
              }
              aria-describedby={describedBy || undefined}
              aria-busy={loading || undefined}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />

            {suffix && <span className={styles.suffix}>{suffix}</span>}

            <div className={styles.endSlot}>
              {showLoading && (
                <span
                  className={styles.spinner}
                  aria-hidden='true'
                  data-testid='input-spinner'
                />
              )}

              {showRevealButton && (
                <button
                  type='button'
                  className={styles.iconButton}
                  onClick={() => setIsPasswordRevealed((revealed) => !revealed)}
                  aria-label={
                    isPasswordRevealed ? 'Hide password' : 'Show password'
                  }
                >
                  {isPasswordRevealed ? (
                    <EyeOff size={18} aria-hidden='true' />
                  ) : (
                    <Eye size={18} aria-hidden='true' />
                  )}
                </button>
              )}

              {showClearButton && (
                <button
                  type='button'
                  className={cn(
                    styles.clearButton,
                    toneClassNameByTone[clearIconTone]
                  )}
                  onClick={handleClear}
                  aria-label='Clear input'
                >
                  {clearIconNode}
                </button>
              )}

              {showEndIcon && resolvedEndIcon && (
                <span
                  aria-hidden='true'
                  className={cn(
                    styles.endAdornment,
                    toneClassNameByTone[endIconTone]
                  )}
                >
                  {resolvedEndIcon}
                </span>
              )}
            </div>
          </div>

          {endAddon && <span className={styles.addon}>{endAddon}</span>}
        </div>

        {shouldShowCounter && (
          <div id={counterId} className={styles.counter}>
            {currentValueText.length} / {maxLength}
          </div>
        )}
      </>
    );

    if (!hasOwnField && field) {
      return control;
    }

    return (
      <FormField
        id={id}
        label={label}
        description={description}
        error={error}
        required={isRequired}
        disabled={isDisabled}
        invalid={isInvalid}
        size={resolvedSize}
        className={wrapperClassName}
        bindControl={false}
      >
        {control}
      </FormField>
    );
  }
);

Input.displayName = 'Input';
