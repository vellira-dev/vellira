import { act } from 'react';

import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../test-utils/render';
import { useControllableState } from './useControllableState';

type Snapshot = {
  value: boolean;
  setValue: (value: boolean) => void;
};

function Probe({
  value,
  onChange,
  capture,
}: {
  value?: boolean;
  onChange?: (value: boolean) => void;
  capture: (snapshot: Snapshot) => void;
}) {
  const [current, setValue] = useControllableState({
    value,
    defaultValue: true,
    onChange,
  });

  capture({ value: current, setValue });
  return <Text>{String(current)}</Text>;
}

describe('useControllableState', () => {
  it('keeps setter identity stable while using the latest callback', () => {
    let snapshot: Snapshot | undefined;
    const first = vi.fn();
    const latest = vi.fn();
    const capture = (next: Snapshot) => {
      snapshot = next;
    };
    const view = render(<Probe capture={capture} onChange={first} />);
    const setter = snapshot?.setValue;

    view.rerender(<Probe capture={capture} onChange={latest} />);
    expect(snapshot?.setValue).toBe(setter);

    act(() => setter?.(false));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(false);
    expect(snapshot?.value).toBe(false);
  });

  it('requests controlled changes without mutating the controlled value', () => {
    let snapshot: Snapshot | undefined;
    const onChange = vi.fn();
    const capture = (next: Snapshot) => {
      snapshot = next;
    };
    const view = render(<Probe value capture={capture} onChange={onChange} />);

    act(() => snapshot?.setValue(false));

    expect(snapshot?.value).toBe(true);
    expect(onChange).toHaveBeenCalledWith(false);

    view.rerender(
      <Probe value={false} capture={capture} onChange={onChange} />
    );
    expect(snapshot?.value).toBe(false);
  });

  it('stops calling a callback removed on a later render', () => {
    let snapshot: Snapshot | undefined;
    const onChange = vi.fn();
    const capture = (next: Snapshot) => {
      snapshot = next;
    };
    const view = render(<Probe capture={capture} onChange={onChange} />);
    const setter = snapshot?.setValue;

    view.rerender(<Probe capture={capture} />);
    act(() => setter?.(false));

    expect(onChange).not.toHaveBeenCalled();
    expect(snapshot?.value).toBe(false);
  });
});
