# Native image test harness

The existing Vitest `react-native` alias now exports a test-only `Image`.
It uses the same style and accessibility projections as the other native mocks.
`accessibilityRole="image"` maps to DOM `img` on both Image and View.

The mock renders an image element without `src`: tests cannot accidentally fetch
an external URL, and neither mounting nor changing source manufactures success.
A committed source starts a request and invokes `onLoadStart`. Explicit load or
error delivery invokes the corresponding `nativeEvent` callback and `onLoadEnd`.
Wrap all event delivery in React `act`.

```tsx
import { act } from 'react';
import { captureNativeImageRequest } from '../../test/native-image.mock';

const image = container.querySelector<HTMLImageElement>('img');
if (!image) throw new Error('Missing image');
const requestA = captureNativeImageRequest(image);
act(() => requestA.load({ width: 24, height: 24 }));
// Or: act(() => requestA.error('decode failure'));
```

Relative imports must be resolved from the actual test directory. The example
above is relative to `src/test-utils`, not to an arbitrary component directory.

A retained request handle preserves its original source and handlers after the
component switches sources. Tests can intentionally deliver A after switching to
B. This does **not** suppress a component's stale-event bug. The current DOM node
also accepts manually dispatched `load` and `error` events. Removing source
removes the active request; unmount removes its registry entry and suppresses
retained event delivery. Independent image instances have independent requests.

URI objects, numeric asset descriptors, and source arrays are retained for
assertions. The mock does not perform native asset resolution, select device
scale candidates, decode pixels, implement a cache, reproduce native timing, or
prove native layout/accessibility behavior. For arrays/assets, a load fixture may
supply its explicit selected `uri`; the mock does not invent one. DOM load events
use jsdom's natural dimensions, so exact-size tests should use explicit fixtures.

Passing these harness tests is not proof that any component satisfies its image,
fallback, geometry, or accessibility contract. Component tests must assert those
behaviors, including error/recovery, source reset and late responses. Browser and
native-device review remain separate evidence.

Run the focused suite through the canonical alias:

```sh
pnpm --filter @vellira-ui/react-native test src/test-utils/native-image-harness.test.tsx
pnpm --filter @vellira-ui/react-native typecheck
```

No component implementation, public API, production contract, readiness flag, or
repair budget is changed by this harness.
