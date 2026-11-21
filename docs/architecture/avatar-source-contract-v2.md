# Avatar Source/Program V2 — contract and acceptance matrix

Status: **PROPOSED / NO FACTORY EXECUTION AUTHORITY**. This is the reviewed source-design
target for public Draft [#1656](https://github.com/vellira-dev/vellira/pull/1656).
It is not a certified candidate, permission to reuse historical #1523, or permission
to spend provider funds. The owner must attest the **final exact HEAD**, not an older
source revision or an untrusted draft body.

## Scope and explicit decisions

The public Component Program source owns the canonical anatomy, internal
`image-status` request lifecycle, semantic module selection and cross-platform
API consequences. The generic `image-fallback` grammar now has explicit
**behavioral, rendered-pixel, loaded-image and accessibility proof subjects**.
A new opt-in, reusable `media-presentation` module requires all three
decisions below; omission causes `semantic-decision-required`, and an unknown
value is invalid composition. No component-name heuristic can silently choose them.

| Decision          | Avatar value                                 | Canonical owner                                            |
| ----------------- | -------------------------------------------- | ---------------------------------------------------------- |
| Default size      | `md`                                         | Explicit `media-presentation.default-size`                 |
| Image fit         | `cover` (center crop, no distortion)         | `media-presentation.image-fit`                             |
| Fallback overflow | `truncate` (single-line, centered, ellipsis) | `media-presentation.fallback-overflow`                     |
| Sizes             | `sm=24`, `md=32`, `lg=40`                    | Human Avatar planning evidence + existing canonical tokens |
| Shape             | Round, clipped contents                      | Human Avatar planning evidence and token/visual review     |
| Risk              | `medium`                                     | Human Avatar planning evidence                             |

Public API stays intentionally minimal: required `name: string` is the
accessible root image name, required `fallback: string` is rendered exactly as
supplied; `size?: 'sm' | 'md' | 'lg'`. Web accepts `source?: string`.
React Native accepts `source?: string | number`, the number being a bundled asset.
No automatic initials derivation, loading spinner, callback API, or alternate
layout is authorized. An empty source behaves as no source. An empty fallback
string remains an empty string, with the root still named by `name`.

## Invariants of the reusable media semantics

1. **Visible image state:** with absent source, pending request or failed
   request, there is **no visible unloaded or broken-image paint** over the
   centered fallback; a confirmed successfully loaded current image fully
   replaces the fallback. Loading and errors must still reach the mounted
   image loader. Implementations may hide the image while pending; the
   contract requires visible behavior, not a hard-coded styling technique.
2. **Current request identity:** changing or removing a source resets the
   image lifecycle. Late `onLoad`/`onError` from a prior source cannot
   repaint the previous image, clear the new fallback or corrupt the new
   successful image. Web URI and Native URI/numeric-asset cases must be covered.
3. **Accessible root:** exactly one image role exposes required `name`.
   The image itself is decorative (Web empty `alt` and hidden from AT;
   React Native child `accessible=false`), and fallback text must not create
   a duplicate announcement at any lifecycle stage. This does not mean
   fallback _pixels_ should be absent.
4. **Geometry and text:** the round, clipped outer bounds follow canonical
   tokens at each size. The fallback remains one line, centered, and does not
   paint beyond those bounds. When longer than available space, ellipsis
   truncation applies without altering `name`.
5. **Themes:** named semantic foreground/background/border tokens support
   light, dark and high contrast; no invented token families or inaccessible
   contrast may be accepted.

## Independent candidate acceptance matrix

This matrix describes **future checks**, not tests already passed by changing
the source contract:

| Evidence                | Required cases                                                                                                        | Gate                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Web real browser pixels | `sm/md/lg`, light/dark/high contrast, no source/pending/real 404/loaded, stable rendering                             | Candidate-independent Chromium proof; browser icon occlusion must be detected |
| Request races           | pending A to B, failed A after B loads, loaded A after B fails, source removal                                        | Mutations must demonstrate stale-event rejection                              |
| Web accessibility       | named root, empty image alt, hidden fallback for AT, single announcement at every state                               | DOM checks and actual AT/screen reader review                                 |
| React Native behavior   | URI and bundled assets, pending/error/success, source-switch, size and truncation                                     | Unit tests **plus actual device/OS, AT and visual evidence**                  |
| Tokens and packaging    | three sizes; round clipping; themes; API/public exports; docs/catalog/Usage                                           | Canonical quality/typecheck/generator and token-preservation gates            |
| Provenance              | exact new base, explicit changed-path allowlist, independent candidate fingerprint, fresh certification and new Draft | Private Factory authority / human review                                      |

All proof must reject a deliberately known-bad overlay and an invalid or missing
presentation decision, rather than merely testing DOM text presence. Tests for
absence/pending/broken visual equality may require a small explicitly justified
rasterization-noise tolerance; it cannot mask a broken-image indicator.

## Backward compatibility and authority boundaries

The reusable module is **opt-in**: decisions without
`media-presentation` continue compiling against the exact historical
`componentGrammarV1` registry, retaining their full Program serialization
and fingerprints (including the pinned pre-extension media baseline).
The compiler selects the distinct `componentGrammarV2` registry only when
`media-presentation` is explicitly present in the reviewed Program decisions.
An arbitrary component name, file path or human planning text cannot select V2.
The stronger media proof subjects and required size/fit/overflow parameters
are scoped to this successor; a missing or invalid decision fails closed.

This V2 grammar and its Avatar-specific decisions yield **new** Program and
grammar fingerprints; both must receive independent source review.
**Do not revise or reuse** the historical private #870 fingerprint/certificate
or old public #1467/#1523. Update the new source review only against
the final code-and-tests HEAD of public #1656.

This change does not create an implementation, editable candidate snapshot,
approval DTO, paid production dispatch, credential access, candidate repair or
certification. Factory's existing durable economic admission remains blocked.
New candidate source generation and delivery require separately reviewed and
audited permissions. Source/Program tests establish compiler rules and intended
behavioral checks; they do **not** prove the future implementation satisfies
them until independent renderers and real device/browser oracles execute.
