import { act } from 'react';

import { Image, View } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { captureNativeImageRequest } from '../../test/native-image.mock';
import { render } from './render';

const cleanups: (() => void)[] = [];
const mount = (...args: Parameters<typeof render>) => {
  const result = render(...args);
  cleanups.push(result.unmount);
  return result;
};
const imageIn = (container: HTMLElement) => {
  const image = container.querySelector<HTMLImageElement>('img');
  if (!image) throw new Error('Missing test image.');
  return image;
};

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

describe('native image harness', () => {
  it('does not fetch or manufacture successful loading', () => {
    const start = vi.fn();
    const load = vi.fn();
    const end = vi.fn();
    const { container } = mount(
      <Image
        source={{ uri: 'https://example.invalid/image.png' }}
        onLoadStart={start}
        onLoad={load}
        onLoadEnd={end}
      />
    );
    const image = imageIn(container);
    expect(image.hasAttribute('src')).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
    act(() =>
      captureNativeImageRequest(image).load({ width: 24, height: 32 })
    );
    expect(load).toHaveBeenCalledWith({
      nativeEvent: {
        source: {
          uri: 'https://example.invalid/image.png',
          width: 24,
          height: 32,
        },
      },
    });
    expect(end).toHaveBeenCalledTimes(1);
  });

  it('projects errors and permits a new source to recover', () => {
    const error = vi.fn();
    const load = vi.fn();
    const end = vi.fn();
    const result = mount(
      <Image
        source={{ uri: 'first' }}
        onError={error}
        onLoadEnd={end}
      />
    );
    act(() =>
      captureNativeImageRequest(imageIn(result.container)).error('unavailable')
    );
    expect(error).toHaveBeenCalledWith({
      nativeEvent: { error: 'unavailable' },
    });
    expect(end).toHaveBeenCalledTimes(1);
    result.rerender(<Image source={{ uri: 'second' }} onLoad={load} />);
    act(() =>
      captureNativeImageRequest(imageIn(result.container)).load({
        width: 1,
        height: 2,
      })
    );
    expect(load).toHaveBeenCalledWith({
      nativeEvent: { source: { uri: 'second', width: 1, height: 2 } },
    });
  });

  it('does not hide stale source responses from component tests', () => {
    const first = vi.fn();
    const second = vi.fn();
    const result = mount(<Image source={{ uri: 'first' }} onLoad={first} />);
    const oldRequest = captureNativeImageRequest(imageIn(result.container));
    result.rerender(<Image source={{ uri: 'second' }} onLoad={second} />);
    const newRequest = captureNativeImageRequest(imageIn(result.container));
    act(() => oldRequest.load({ width: 1, height: 1 }));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    act(() => newRequest.load({ width: 2, height: 2 }));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('updates callbacks without restarting an unchanged source', () => {
    const start = vi.fn();
    const first = vi.fn();
    const second = vi.fn();
    const result = mount(
      <Image source={{ uri: 'same' }} onLoad={first} onLoadStart={start} />
    );
    result.rerender(
      <Image source={{ uri: 'same' }} onLoad={second} onLoadStart={start} />
    );
    act(() =>
      captureNativeImageRequest(imageIn(result.container)).load({
        width: 1,
        height: 1,
      })
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes the active request when the source is removed', () => {
    const result = mount(<Image source={{ uri: 'first' }} />);
    result.rerender(<Image />);
    expect(() =>
      captureNativeImageRequest(imageIn(result.container))
    ).toThrow('No committed native image request');
  });

  it('does not deliver retained events after unmount', () => {
    const load = vi.fn();
    const error = vi.fn();
    const result = render(
      <Image source={{ uri: 'first' }} onLoad={load} onError={error} />
    );
    const image = imageIn(result.container);
    const request = captureNativeImageRequest(image);
    result.unmount();
    act(() => {
      request.load({ width: 1, height: 1 });
      request.error('late');
    });
    expect(load).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(() => captureNativeImageRequest(image)).toThrow();
  });

  it.each([
    { source: 123 },
    { source: [{ uri: 'one' }, { uri: 'two' }] },
  ])('preserves a non-URI descriptor without device resolution', ({ source }) => {
    const { container } = mount(<Image source={source} />);
    expect(captureNativeImageRequest(imageIn(container)).source).toEqual(source);
  });

  it('isolates image instances', () => {
    const first = vi.fn();
    const second = vi.fn();
    const a = mount(<Image source={{ uri: 'same' }} onLoad={first} />);
    const b = mount(<Image source={{ uri: 'same' }} onLoad={second} />);
    act(() =>
      captureNativeImageRequest(imageIn(a.container)).load({
        width: 1,
        height: 1,
      })
    );
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    expect(imageIn(a.container)).not.toBe(imageIn(b.container));
  });

  it('projects image roles on both the accessible wrapper and image', () => {
    const { container } = mount(
      <View accessibilityRole='image' accessibilityLabel='Person'>
        <Image
          source={{ uri: 'image' }}
          accessible={false}
          testID='decorative'
        />
      </View>
    );
    expect(
      container.querySelector('[aria-label="Person"]')?.getAttribute('role')
    ).toBe('img');
    expect(imageIn(container).getAttribute('aria-hidden')).toBe('true');
  });

  it('preserves exact flattened style dimensions', () => {
    const { container } = mount(
      <Image
        source={{ uri: 'image' }}
        style={[{ width: 24 }, { height: 32 }]}
      />
    );
    expect(imageIn(container).style.width).toBe('24px');
    expect(imageIn(container).style.height).toBe('32px');
  });

  it('also projects manually dispatched DOM load and error events', () => {
    const load = vi.fn();
    const error = vi.fn();
    const { container } = mount(
      <Image source={{ uri: 'image' }} onLoad={load} onError={error} />
    );
    const image = imageIn(container);
    act(() => image.dispatchEvent(new Event('load')));
    expect(load).toHaveBeenCalledTimes(1);
    act(() => image.dispatchEvent(new Event('error')));
    expect(error).toHaveBeenCalledWith({
      nativeEvent: { error: 'Native image mock load error.' },
    });
  });
});
