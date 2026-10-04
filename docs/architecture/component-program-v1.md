# Component Grammar and Component Program V1

Component names identify public artifacts; they do not select semantic architecture.
Program V1 adds a finite, public composition contract to existing metadata, intent,
Generator V2 and Component Production. It is not a replacement runtime framework.

## Authority and ordering

```text
public intent / capability coverage
  → approved semantic decisions + public grammar
  → canonical Component Program + existing Semantic Planner/API approval
  → immutable semantic/API handoff
  → deterministic Generator / bounded implementation
  → existing canonical validation + independent proof / human review
```

`packages/metadata/src/component.ts` and `componentIntent.ts` remain the capability,
platform, profile and resource requirement authorities. `packages/types/src` owns
shared runtime API contracts. A program's `source` is derived from the normalized
production input, never separately authored. Work-item, component name, filesystem
location and exact repository revision remain production identity, not semantic
architecture selectors.

`packages/metadata/src/componentProgram.ts` defines the public schema.
`scripts/component-program/grammar.ts` owns reusable semantic modules, typed state
slots, sparse composition laws, platform adapters and proof obligations.
`compile.ts` is the sole compiler. Private consumers invoke it in an exact public
source checkout rather than copying the grammar or implementing another solver.

Production input may carry `componentProgram`, containing reviewed **decisions**:

- `schemaVersion: "1"`;
- anatomy nodes with stable local IDs, roles and parent references;
- typed state domains, ownership and an explicitly selected API convention;
- scoped event/transition declarations;
- module selections with typed state bindings and declared scalar parameters.

The compiler emits a different representation: immutable **Component Program V1**,
including the normalized source/decisions, grammar content identity, dependency
order, scoped capability traces, API consequences, platform plans and proof subjects.
Neither that program nor its graph is a second hand-maintained source document.

## Why this representation

The audit found four existing profiles, 26 capability identifiers, canonical shared
types and established runtime behavior helpers. Profiles/capability sets do not say
which state a capability owns, which API convention applies, or how independent
pause reasons compose. Making a form profile imply one universal value API would
contradict existing boolean, text, selection and derived field-context contracts.

The evaluated alternatives were capability bags, enriched profiles, a monolithic
typed IR, state-machine-first, constraint graphs, traits/protocols, archetype templates,
and a small typed program with a derived graph. Bags/profiles remain useful inputs
but hide interactions; templates grow family-by-feature combinations; a state-machine
runtime adds structural adapters and state-product complexity; a trait solver adds
resolution/coherence machinery. A graph alone still needs typed node/state payloads.

The chosen representation keeps typed semantic decisions and a finite dependency
graph without adding a runtime interpreter, graph database, universal ontology or
search over possible module combinations. Display/media, temporal feedback, forms,
compound overlays and collections are covered by synthetic executable compositions.
This is a bounded choice under the audited constraints, not a claim of universal
optimality.

## Composition and failure behavior

The compiler checks requires, deterministic implies closure, conflicts, dependency
cycles, state ownership/domain compatibility, shared-state identity, anatomy cycles,
capability scope, platform-only restrictions, parameter domains and required events.
Contradictory transitions for the same state/event/platform fail closed. No conflict
is resolved by silently picking a winning module.

Examples of existing semantics reused:

- shared checked/open/value conventions originate in canonical shared types;
- image lifecycle distinguishes source change, load and error and binds fallback to
  the same source state;
- disclosure/collection and controlled state remain separate reusable concepts;
- overlay presentation uses existing platform presentation/focus infrastructure;
- transient timing preserves active deadlines, independent Web pointer/focus pauses,
  remaining duration, close/unmount cleanup and at-most-once timeout;
- motion preference cannot write the timer state;
- collection stacking has an explicit bounded maximum and overflow choice;
- announcement uses Web live-region versus native accessibility mechanisms without
  declaring DOM mechanics in shared/native authority.

The result distinguishes:

| Disposition                  | Meaning                                                               |
| ---------------------------- | --------------------------------------------------------------------- |
| `compiled`                   | Static composition is valid; not behavioral proof or review readiness |
| `review-required`            | Expressible, but a binding/API/policy decision is missing             |
| `missing-grammar-capability` | A reviewed reusable primitive is absent                               |
| `blocked`                    | Invalid schema, contradiction, authority/scope error or invalid graph |

Unknown fields and schema versions are rejected. Ordinary programs cannot contain
custom code, custom validators, provider-authored adapters or opaque metadata.
No confidence value can override these dispositions.

## API and implementation boundary

An explicitly chosen `open`, `checked` or `value` convention can imply value,
initial/default and change members, including their state value types. Merely
declaring controlled state cannot choose that convention. The output records these
deterministic consequences; the existing semantic/API approval lane checks them
against the complete contract before implementation.

It does not invent callback reason domains, source types, modality, visual design,
collection activation policy or arbitrary product APIs. A simple consequence is
not permission to flatten an existing discriminated union or replace an approved
callback shape. Unresolved or incompatible API authority goes back to review.

Generator preflight recompiles program-bearing inputs and refuses unresolved
programs. Generated structure and shared type ownership remain Generator V2's
responsibility. Provider completion and repair receive read-only program evidence;
they acquire no writable grammar, spec, tooling or API-contract paths.

## Proof subjects, not self-certification

Each module links to stable obligation IDs, quality dimensions, platform scope and
the existing `automated` / `human-review` distinction. Existing checker references
are structural evidence only. Behavioral laws also retain separate review/independent
proof obligations; a regex check does not certify deadline or focus correctness.

Future independent proof can bind program fingerprint + module + obligation +
platform to an oracle, reviewer and mutation result without reverse-engineering
generated source. This change does not claim that independent proof is complete.
All existing completeness, quality, API, tests, types/build, docs, website, visual,
tooling and smoke gates remain required.

## Identity, replay and compatibility

The canonical program is serialized with sorted object keys, deterministic set
ordering and normalized duplicate module selections. SHA-256 identities use the
`component-grammar-v1:` and `component-program-v1:` domains. Program identity excludes
component name/path/provider output. A separate production binding includes exact
source revision, normalized specification and existing semantic plan identity.

Recompilation verifies both source authority and every derived field. Tampered
output or an unchanged claimed fingerprint over changed semantics is rejected.
Material program changes alter planning/production identity and cannot reuse an
incompatible candidate. Optional absence preserves legacy production inputs;
no program is retroactively inserted into a sealed historical lineage.

Learning consumers may retain version, hash, module IDs, disposition and exact
authority revisions through their existing bounded observer. Learning is not
execution authority. Demand selection remains upstream of public capability
coverage; this language neither selects roadmap components nor authorizes creation.

## Catalog audit and honest limits

Run the read-only report:

```sh
node --import tsx scripts/component-program/catalog.ts
```

Membership is derived from `componentMetadata` and `componentExpansionCatalog`.
At the audited baseline this is 15 registered components plus 7 targets, 20 distinct
identities. All declared capability identifiers have grammar coverage. The report
exposes required anatomy/state/event bindings, modules, platform differences,
resources, proof references and unresolved policy decisions for every identity.

It deliberately does **not** mark all existing components fully compiled. Metadata
does not contain every existing API decision: examples include text transformations,
virtual/command collection behavior and the difference between declared control
capabilities and a delayed-disclosure API. Existing canonical APIs remain valid;
adopting a program requires explicit reviewed decisions rather than name-based
inference or a mass rewrite. The report distinguishes capability expressibility
from complete approved programs.

Calendar arithmetic, hierarchical navigation, virtualization/focus retention, drag
transactions, geometry gestures and composite editing are stress cases, not new
roadmap targets or implemented V1 behaviors. Unsupported modules return a missing
grammar result, never an unrestricted escape hatch.

## Extension and bounds

Add one reviewed reusable module/domain/adapter, not component-specific code:

1. Cite existing public capability/API/runtime evidence or approve a reusable gap.
2. Define typed slots, scope, constraints and deterministic consequences.
3. Specify any unresolved bounded policy choices; do not default them by name.
4. Link platform mechanisms, proof owners, obligations and documentation effects.
5. Add positive, conflicting, platform, identity and mutation fixtures.
6. Review the new content identity/schema and update pinned consumers deliberately.

V1 permits at most 64 selected modules, 32 state slots, 64 anatomy nodes,
128 transitions, two platforms and bounded identifiers/parameters. Input decisions
are bounded to 64 KiB; the command envelope is bounded separately. Resolution walks
the supplied graph; it never enumerates subsets or the product of state values.
Graph work is linear in nodes/edges, with bounded platform passes and sorting for
canonical serialization. Adding components increases compositions, not name branches.

## Offline usage

The compiler accepts one production input on stdin and performs no generation,
provider request, workflow dispatch, publication or merge:

```sh
node --import tsx scripts/component-program/cli.ts < reviewed-spec.json
```

Synthetic fixtures and adversarial tests live under `scripts/component-program`.
Existing active production candidates are not development fixtures. Human review
and merge remain the final authority for changes to the public language.
