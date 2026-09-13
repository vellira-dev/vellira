'use client';

import { useId, type ReactNode } from 'react';

import { Button, Input } from '@vellira-ui/react';

import styles from './PlaygroundControls.module.css';

export type PlaygroundControlPlatform = 'react' | 'react-native';

type PlaygroundControlGroupProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
};

export function PlaygroundControlGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: PlaygroundControlGroupProps<T>) {
  return (
    <div className={styles.controlGroup}>
      <span className={styles.controlLabel}>{label}</span>

      <div className={styles.segmented}>
        {options.map((option) => (
          <Button
            appearance='bare'
            key={option}
            type='button'
            className={styles.control}
            data-active={value === option || undefined}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

type PlaygroundToggleProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PlaygroundToggle({
  label,
  checked,
  onChange,
}: PlaygroundToggleProps) {
  return (
    <Button
      appearance='bare'
      type='button'
      className={styles.control}
      data-active={checked || undefined}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      {label}
    </Button>
  );
}

type PlaygroundTextInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

export function PlaygroundTextInput({
  label,
  value,
  placeholder,
  onChange,
}: PlaygroundTextInputProps) {
  const id = useId();

  return (
    <div className={styles.controlGroup}>
      <label htmlFor={id} className={styles.controlLabel}>
        {label}
      </label>

      <Input
        id={id}
        variant='bare'
        wrapperClassName={styles.textField}
        className={styles.textInput}
        type='text'
        value={value}
        placeholder={placeholder}
        onValueChange={onChange}
      />
    </div>
  );
}

type PlaygroundNumberInputProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

export function PlaygroundNumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: PlaygroundNumberInputProps) {
  const id = useId();

  return (
    <div className={styles.controlGroup}>
      <label htmlFor={id} className={styles.controlLabel}>
        {label}
      </label>

      <Input
        id={id}
        variant='bare'
        wrapperClassName={styles.textField}
        className={styles.textInput}
        type='number'
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onChange(Number(nextValue))}
      />
    </div>
  );
}

type PlaygroundOptionsProps = {
  label?: string;
  children: ReactNode;
};

export function PlaygroundOptions({
  label = 'Options',
  children,
}: PlaygroundOptionsProps) {
  return (
    <div className={styles.controlGroup}>
      <span className={styles.controlLabel}>{label}</span>

      <div className={styles.segmented}>{children}</div>
    </div>
  );
}

type PlaygroundControlsProps = {
  children: ReactNode;
};

export function PlaygroundControls({ children }: PlaygroundControlsProps) {
  return <div className={styles.controls}>{children}</div>;
}

type PlaygroundControlBase<T extends Record<string, unknown>> = {
  key: keyof T;
  label: string;
  platforms?: readonly PlaygroundControlPlatform[];
};

export type PlaygroundSelectControl<T extends Record<string, unknown>> =
  PlaygroundControlBase<T> & {
    type: 'select';
    options: readonly string[];
  };

export type PlaygroundToggleControl<T extends Record<string, unknown>> =
  PlaygroundControlBase<T> & {
    type: 'toggle';
    group?: string;
  };

export type PlaygroundTextControl<T extends Record<string, unknown>> =
  PlaygroundControlBase<T> & {
    type: 'text';
    placeholder?: string;
  };

export type PlaygroundNumberControl<T extends Record<string, unknown>> =
  PlaygroundControlBase<T> & {
    type: 'number';
    min?: number;
    max?: number;
    step?: number;
  };

export type PlaygroundControl<T extends Record<string, unknown>> =
  | PlaygroundSelectControl<T>
  | PlaygroundToggleControl<T>
  | PlaygroundTextControl<T>
  | PlaygroundNumberControl<T>;

type PlaygroundControlsFromSchemaProps<T extends Record<string, unknown>> = {
  platform: PlaygroundControlPlatform;
  value: T;
  controls: readonly PlaygroundControl<T>[];
  onChange: <K extends keyof T>(key: K, value: T[K]) => void;
};

export function PlaygroundControlsFromSchema<
  T extends Record<string, unknown>,
>({
  platform,
  value,
  controls,
  onChange,
}: PlaygroundControlsFromSchemaProps<T>) {
  const activeControls = controls.filter(
    (control) => !control.platforms || control.platforms.includes(platform)
  );

  const selectControls = activeControls.filter(
    (control) => control.type === 'select'
  );

  const toggleGroups = new Map<string, PlaygroundToggleControl<T>[]>();

  for (const control of activeControls) {
    if (control.type !== 'toggle') {
      continue;
    }

    const group = control.group ?? 'Options';
    const current = toggleGroups.get(group) ?? [];

    current.push(control);
    toggleGroups.set(group, current);
  }

  return (
    <PlaygroundControls>
      {selectControls.map((control) => (
        <PlaygroundControlGroup
          key={String(control.key)}
          label={control.label}
          value={String(value[control.key])}
          options={control.options}
          onChange={(nextValue) =>
            onChange(control.key, nextValue as T[typeof control.key])
          }
        />
      ))}

      {activeControls
        .filter((control) => control.type === 'text')
        .map((control) => (
          <PlaygroundTextInput
            key={String(control.key)}
            label={control.label}
            value={String(value[control.key] ?? '')}
            placeholder={control.placeholder}
            onChange={(nextValue) =>
              onChange(control.key, nextValue as T[typeof control.key])
            }
          />
        ))}

      {activeControls
        .filter((control) => control.type === 'number')
        .map((control) => (
          <PlaygroundNumberInput
            key={String(control.key)}
            label={control.label}
            value={Number(value[control.key] ?? 0)}
            min={control.min}
            max={control.max}
            step={control.step}
            onChange={(nextValue) =>
              onChange(control.key, nextValue as T[typeof control.key])
            }
          />
        ))}

      {[...toggleGroups.entries()].map(([group, toggles]) => (
        <PlaygroundOptions key={group} label={group}>
          {toggles.map((control) => (
            <PlaygroundToggle
              key={String(control.key)}
              label={control.label}
              checked={Boolean(value[control.key])}
              onChange={(checked) =>
                onChange(control.key, checked as T[typeof control.key])
              }
            />
          ))}
        </PlaygroundOptions>
      ))}
    </PlaygroundControls>
  );
}
