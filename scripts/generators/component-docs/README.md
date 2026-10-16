# Component documentation: safe legacy adoption

Vellira's documentation generator manages pages only after an explicitly
reviewed migration. Existing manually authored pages often contain unique
examples, accessibility notes, and platform-specific explanations.

## Read-only inventory

Run these commands from the repository root:

    pnpm component-docs:adoption-audit
    pnpm component-docs:adoption-audit Dropdown --json

The command reports every canonical React and React Native component-doc page,
its ownership status, whether the component has a registered docs contract, and
a SHA-256 hash of the original Markdown. It never modifies files.

Possible ownership states: managed, legacy, missing, invalid-markers, and
untrusted-markers.

## Safety boundary

An existing unmarked Markdown page cannot be overwritten by the component
docs generator, even with the --force flag. The generator checks all selected
platform pages before writing any of them.

A managed document must have exactly one valid authored region and the
generator ownership header. Authored markers alone do not establish generator
ownership. Malformed or ambiguous ownership always fails closed.

The --force flag is retained for compatibility with managed documents; it is
not an unreviewed migration escape hatch.

## Repository-wide CI coverage

`pnpm check:component --all` checks every canonical component whose metadata
requires docs. Unregistered component Markdown in `apps/docs/src/react/` and
`apps/docs/src/react-native/` is blocking, even when it has no generator marker.
Generated pages without a contract remain blocking orphans. The only currently
reviewed standalone-page exceptions are `index.md`, `portal.md`, and
`theme-provider.md` on each platform. A new exception needs a deliberate,
reviewed change to the check, not an untracked manual page.

VitePress sidebars derive component links from the canonical docs registry. The
navigation assertion rejects duplicate links before the docs build succeeds.
Existing independent Portal and ThemeProvider pages remain untouched.

## How to migrate a legacy page

1. Run the read-only audit for the component. Record original source hashes
   in the migration PR and review each supported platform independently.
2. Verify the component's canonical metadata, public API and docs contract.
   Do not invent unsupported React or React Native behavior.
3. Prepare a separate, reviewable Markdown migration that preserves all
   valuable original editorial explanations, examples and links inside the
   authored region. Reconcile frontmatter and duplicate generated headings
   explicitly during editorial review.
4. Compare the complete Markdown diff against the original, then run docs
   generator checks, VitePress build, component-page tests and CI.
5. Confirm regeneration is idempotent and does not change authored content.

This preparation adds guardrails and a read-only migration inventory. It does
not rewrite or publish any existing documentation and does not backfill the
existing website catalog in bulk. Those changes remain separate under #1136.
