# Vellira Storybook

Web Storybook app for `@vellira-ui/react`.

Use this app to develop, document, and visually review web components. Web stories live next to components in `packages/react/src/**/*.stories.tsx`.

## Development

From the workspace root:

```bash
pnpm --filter @vellira-ui/react-storybook dev
```

Storybook runs on port `6006`.

## Build

```bash
pnpm --filter @vellira-ui/react-storybook build-storybook
```

## Tests And Visual Review

Component behavior tests live in `packages/react/src/**/*.test.tsx` and run with:

```bash
pnpm --filter @vellira-ui/react test
```

Storybook behavior and accessibility E2E tests intentionally exclude screenshot baselines and may run on a developer host:

```bash
pnpm test:e2e:web
```

The focused cross-browser interaction launch contracts reuse the same Storybook
server and Playwright configuration. They run one representative desktop
scenario for each interaction-heavy component in Chromium, Firefox, and WebKit:

| Component | Browser-level contract                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Select    | Keyboard focus and dismissal, portaled listbox geometry, plus touch selection in the existing mobile Chromium project    |
| Dropdown  | Native keyboard navigation, focus restoration, outside dismissal, portal placement, and open/close state                 |
| Modal     | Initial focus, real tab order and focus wrapping, scroll lock, portal rendering, Escape dismissal, and focus restoration |
| Popover   | Controlled React state across outside and Escape dismissal, portal rendering, and focus restoration                      |
| Tabs      | Native sequential tab order, arrow-key focus movement, roving tab stops, and controlled content updates                  |
| Tooltip   | Focus entry, tab-away dismissal, portal rendering, ARIA connection, and viewport collision handling                      |

Run only the desktop launch-contract matrix with:

```bash
pnpm test:e2e:web:cross-browser
```

The launch-contract describe block disables retries so intermittent browser
behavior cannot be hidden. The shared configuration uses reduced motion and
keeps traces and screenshots only when a test fails. On macOS, WebKit scenarios
use Option+Tab for ordinary button traversal, matching Safari's native keyboard
access behavior without changing the component contract.

Screenshot regression has one canonical rendering environment: the pinned Linux Playwright image used by both Docker and CI. Run it locally with:

```bash
pnpm test:e2e:web:visual:docker
```

Committed screenshot baselines must only be regenerated from that canonical environment:

```bash
pnpm docker:e2e:update
```

Do not update visual baselines from native macOS or Windows runs. Host text rasterization can differ even when component CSS and token values are identical. The visual command is guarded so canonical snapshots require Linux/amd64 on the pinned Ubuntu noble Playwright environment.

The canonical runner keeps the existing screenshot project names, device profiles, and visual thresholds. Those should only change with separate measured evidence; environment determinism is not a reason to widen `maxDiffPixelRatio`.

Chromatic publishes the hosted visual review build from this Storybook app.

## Notes

- Uses Storybook React Vite.
- Uses Chromatic for hosted visual review.
- Fonts used by Storybook come from `@vellira-ui/assets`.
- The Storybook manager, story canvas, and docs mode all apply
  `var(--font-family-base)` so hosted examples use Vellira typography.
- Storybook E2E already verifies that `Vellira Sans` resolves in story and docs canvases before relying on visual output.
