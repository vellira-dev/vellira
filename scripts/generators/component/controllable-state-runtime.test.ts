import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import { renderSharedOverlayTypesTemplate } from './templates/component-types';
import {
  renderNativeOverlayComponentTemplate,
  renderNativeOverlayTypesTemplate,
} from './templates/component-overlay-native';
import {
  renderWebOverlayComponentTemplate,
  renderWebOverlayTypesTemplate,
} from './templates/component-overlay-web';

const fixtureName = 'LifecycleProbe';

function renderRuntimeTests(isNative: boolean, regressed: boolean) {
  const hookModule = regressed
    ? './regressed-hook'
    : '../../hooks/useControllableState';

  return `import { act, useEffect, useLayoutEffect } from 'react';

import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useControllableState } from '${hookModule}';
import { LifecycleProbe } from './LifecycleProbe';

type State = { value: boolean; setValue: (next: boolean) => void };
type ProbeProps = {
  value?: boolean;
  initial?: boolean;
  duration?: number;
  onChange?: (next: boolean) => void;
  observe: (state: State) => void;
};

function StateProbe({
  value, initial = true, duration = 0, onChange, observe,
}: ProbeProps) {
  const [current, setValue] = useControllableState({
    value,
    defaultValue: initial,
    // A real consumer may wrap its callback on every render.
    onChange: (next) => onChange?.(next),
  });
  useLayoutEffect(() => {
    observe({ value: current, setValue });
  }, [current, observe, setValue]);
  useEffect(() => {
    if (!current || duration <= 0) return;
    const timer = setTimeout(() => setValue(false), duration);
    return () => clearTimeout(timer);
  }, [current, duration, setValue]);
  return <span>{current ? 'open' : 'closed'}</span>;
}

function stateObserver() {
  let current: State | undefined;
  return {
    observe: (state: State) => { current = state; },
    read: () => {
      if (!current) throw new Error('State probe did not commit.');
      return current;
    },
  };
}

const cleanups: Array<() => void> = [];
function mount(ui: Parameters<typeof render>[0]) {
  const view = render(ui);
  cleanups.push(view.unmount);
  return view;
}

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.useRealTimers();
});

describe('canonical controllable-state runtime', () => {
  it('keeps setter identity across callback-only rerenders', () => {
    const state = stateObserver();
    const before = vi.fn();
    const after = vi.fn();
    const view = mount(<StateProbe observe={state.observe} onChange={before} />);
    const setter = state.read().setValue;
    view.rerender(<StateProbe observe={state.observe} onChange={after} />);
    expect(state.read().setValue).toBe(setter);
    act(() => setter(false));
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenLastCalledWith(false);
    expect(state.read().value).toBe(false);
  });

  it('preserves an active deadline across callback-only rerenders', () => {
    vi.useFakeTimers();
    const state = stateObserver();
    const before = vi.fn();
    const after = vi.fn();
    const view = mount(
      <StateProbe duration={1000} observe={state.observe} onChange={before} />
    );
    act(() => vi.advanceTimersByTime(400));
    view.rerender(
      <StateProbe duration={1000} observe={state.observe} onChange={after} />
    );
    act(() => vi.advanceTimersByTime(599));
    expect(state.read().value).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(state.read().value).toBe(false);
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenLastCalledWith(false);
  });

  it('uses the latest callback through a retained setter', () => {
    const state = stateObserver();
    const before = vi.fn();
    const after = vi.fn();
    const view = mount(<StateProbe observe={state.observe} onChange={before} />);
    const setter = state.read().setValue;
    view.rerender(<StateProbe observe={state.observe} onChange={after} />);
    act(() => setter(false));
    expect(before).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenLastCalledWith(false);
  });

  it('does not call a removed callback through a retained setter', () => {
    const state = stateObserver();
    const onChange = vi.fn();
    const view = mount(<StateProbe observe={state.observe} onChange={onChange} />);
    const setter = state.read().setValue;
    view.rerender(<StateProbe observe={state.observe} />);
    act(() => setter(false));
    expect(onChange).not.toHaveBeenCalled();
    expect(state.read().value).toBe(false);
  });

  it('does not mutate controlled state on a requested change', () => {
    const state = stateObserver();
    const onChange = vi.fn();
    const view = mount(
      <StateProbe value observe={state.observe} onChange={onChange} />
    );
    act(() => state.read().setValue(false));
    expect(state.read().value).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(false);
    view.rerender(
      <StateProbe value={false} observe={state.observe} onChange={onChange} />
    );
    expect(state.read().value).toBe(false);
  });

  it('preserves internal state when defaultValue changes', () => {
    const state = stateObserver();
    const view = mount(<StateProbe initial observe={state.observe} />);
    act(() => state.read().setValue(false));
    view.rerender(<StateProbe initial observe={state.observe} />);
    expect(state.read().value).toBe(false);
    act(() => state.read().setValue(true));
    view.rerender(<StateProbe initial={false} observe={state.observe} />);
    expect(state.read().value).toBe(true);
  });

  it('preserves the existing controlled-mode transition behavior', () => {
    const state = stateObserver();
    const view = mount(<StateProbe value observe={state.observe} />);
    act(() => state.read().setValue(false));
    expect(state.read().value).toBe(true);
    view.rerender(<StateProbe observe={state.observe} />);
    act(() => state.read().setValue(false));
    expect(state.read().value).toBe(false);
    view.rerender(<StateProbe value observe={state.observe} />);
    act(() => state.read().setValue(false));
    expect(state.read().value).toBe(true);
  });

  it('cleans up the consumer timeout on unmount', () => {
    vi.useFakeTimers();
    const state = stateObserver();
    const onChange = vi.fn();
    const view = render(
      <StateProbe duration={1000} observe={state.observe} onChange={onChange} />
    );
    act(() => vi.advanceTimersByTime(400));
    view.unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('generated overlay state adapter', () => {
  it('preserves the generated controlled rendering contract', () => {
    const view = mount(<LifecycleProbe open>Generated content</LifecycleProbe>);
    expect(view.container.textContent).toContain('Generated content');
    view.rerender(
      <LifecycleProbe open={false}>Generated content</LifecycleProbe>
    );
    ${
      isNative
        ? "expect(view.container.textContent).not.toContain('Generated content');"
        : "expect(view.container.querySelector('[data-state]')?.getAttribute('data-state')).toBe('closed');"
    }
  });

  it('preserves the generated uncontrolled initial state', () => {
    const view = mount(
      <LifecycleProbe defaultOpen>Generated content</LifecycleProbe>
    );
    view.rerender(
      <LifecycleProbe defaultOpen={false}>Generated content</LifecycleProbe>
    );
    expect(view.container.textContent).toContain('Generated content');
  });
});
`;
}

// Deliberately defective former semantics, scoped to an unexported test fixture.
const regressedHook = `import { useCallback, useState } from 'react';
export function useControllableState<T>({ value, defaultValue, onChange }: {
  value?: T; defaultValue: T; onChange?: (value: T) => void;
}) {
  const [internal, setInternal] = useState(defaultValue);
  const controlled = value !== undefined;
  const setValue = useCallback((next: T) => {
    if (!controlled) setInternal(next);
    onChange?.(next);
  }, [controlled, onChange]);
  return [controlled ? value : internal, setValue] as const;
}
`;

function runCommand(cwd: string, args: string[]) {
  return spawnSync('pnpm', args, {
    cwd,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });
}

describe('generated canonical state adapters', () => {
  it.each(['react', 'react-native'] as const)(
    'typechecks and executes the %s adapter and rejects unstable callbacks',
    (platform) => {
      const packageRoot = path.resolve('packages', platform);
      const root = fs.mkdtempSync(
        path.join(packageRoot, 'src', '__generated-state-runtime-')
      );
      const directory = path.join(root, fixtureName);
      const isNative = platform === 'react-native';
      const params = { componentName: fixtureName };
      try {
        fs.mkdirSync(directory);
        const platformTypes = isNative
          ? renderNativeOverlayTypesTemplate(params)
          : renderWebOverlayTypesTemplate(params);
        fs.writeFileSync(
          path.join(directory, 'types.ts'),
          renderSharedOverlayTypesTemplate(params) +
            platformTypes.replace(
              `import type { Base${fixtureName}Props } from '@vellira-ui/types';`,
              ''
            )
        );
        fs.writeFileSync(
          path.join(directory, `${fixtureName}.tsx`),
          isNative
            ? renderNativeOverlayComponentTemplate(params)
            : renderWebOverlayComponentTemplate(params)
        );
        const testFile = path.join(directory, `${fixtureName}.test.tsx`);
        fs.writeFileSync(testFile, renderRuntimeTests(isNative, false));
        const typecheck = runCommand(packageRoot, [
          'exec',
          'tsc',
          '-p',
          'tsconfig.typecheck.json',
          '--noEmit',
        ]);
        expect(
          typecheck.status,
          `${typecheck.error ?? ''}\n${typecheck.stdout}\n${typecheck.stderr}`
        ).toBe(0);

        const reportPath = path.join(root, 'runtime-report.json');
        const args = [
          'exec',
          'vitest',
          'run',
          path.relative(packageRoot, testFile),
          '--config',
          'vitest.config.ts',
          '--reporter=json',
          `--outputFile=${reportPath}`,
        ];
        const positive = runCommand(packageRoot, args);
        expect(
          positive.status,
          `${positive.error ?? ''}\n${positive.stdout}\n${positive.stderr}`
        ).toBe(0);

        const positiveReport = JSON.parse(
          fs.readFileSync(reportPath, 'utf8')
        ) as { numTotalTests: number; numPassedTests: number };
        expect(positiveReport.numTotalTests).toBe(10);
        expect(positiveReport.numPassedTests).toBe(10);
        fs.rmSync(reportPath);
        fs.writeFileSync(
          path.join(directory, 'regressed-hook.ts'),
          regressedHook
        );
        fs.writeFileSync(testFile, renderRuntimeTests(isNative, true));
        const negative = runCommand(packageRoot, args);
        expect(negative.error).toBeUndefined();
        expect(negative.status).toBe(1);
        // Prove that runtime assertions, not compilation/import errors, failed.
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
          testResults: Array<{
            assertionResults: Array<{ title: string; status: string }>;
          }>;
        };
        const failed = report.testResults.flatMap(({ assertionResults }) =>
          assertionResults
            .filter(({ status }) => status === 'failed')
            .map(({ title }) => title)
        );
        expect(failed).toContain(
          'keeps setter identity across callback-only rerenders'
        );
        expect(failed).toContain(
          'preserves an active deadline across callback-only rerenders'
        );
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
    300_000
  );
});
