# Agent context — scheme-tokens

`AGENTS.md` holds the operating rules. This file holds the reasoning behind them: what is already
settled, what enforces it, and which alternatives were evaluated and rejected. Read it before
proposing an architectural change.

## What this package is

A COMPILER for design tokens, not a transformer. Style Dictionary and Terrazzo consume a format and emit platform files.
This compiles a token graph: layered composition, visibility enforcement, provenance, structured diagnostics,
deterministic output. Do not add platform transforms (Swift/Android/Sass) — that is Style Dictionary's ground and out of
scope.

## Hard boundaries (enforced, do not relax)

- Core owns NO color model. Token values are opaque strings. tests/unit/package-boundary.test.ts asserts parseColor is
  absent; scripts/check-api.ts fails the build if the bundle contains "material3".
- No filesystem access and JSON-safe public data. Trusted authoring helpers may throw for programmer misuse. Parsers
  accepting untrusted `unknown` data must return structured `Result` failures and must not use throw-based user-data
  validation. The package must remain runnable in a browser — that is a deliberate differentiator.
- Zero runtime dependencies in core.

## Contractual surface (a change here is BREAKING)

- CSS declaration ordering and block ordering
- Serialization key ordering
- Issue codes (49) and their JSON Pointer paths
- The wire format / formatVersion Treat these as public API even though they are not types.

The package is published, so a change to any of the above needs a changeset and ships as a minor bump while the line is
below 1.0. A TypeScript declaration change also needs an API snapshot diff. The snapshot gate cannot detect behavioural
changes such as ordering when declarations remain unchanged, so review and policy own those cases. A changed contract
never ships as an alias next to the old shape.

## Settled decisions — do not re-propose

- Modes are a FLAT list. First-class orthogonal axes (palette x scheme) were evaluated and rejected: formatVersion 2,
  three schema rewrites, ~400 lines, broken pointer contract. docs/application-theme-coordinates.md prescribes
  flattening at the application boundary. Keep it.
- Bare strings are NEVER references. tokenRef () or {ref} only.
- Gamut and color space are APPLICATION concerns, not token concerns. Core never learns what sRGB or P3 are.

## Material 3 adapter handoff

- [ADR 0005](./adr/0005-material3-adapter-package-boundary.md) owns the optional adapter package
  boundary; [ADR 0006](./adr/0006-material3-authoring-and-mode-contract.md) owns authoring, modes,
  and composition; [ADR 0007](./adr/0007-material3-engine-and-role-contract.md) owns the pinned
  engine, accepted roles, and capabilities. [ADR 0008](./adr/0008-material3-fragment-layer-type.md)
  narrowly supersedes ADR 0006's fragment layer generic. ADR 0004 is historical and superseded by
  these decision slices.
- `tests/rnd/material3` is transitional phase-1 evidence, not a second implementation authority.
  When `packages/material3` lands, migrate useful engine, golden, and type gates into that package,
  then remove redundant R&D workspace plumbing. Core remains Material-free.
- Until implementation, the core boundary test intentionally asserts that `packages/material3`
  does not exist. When the optional sibling package is created, replace that temporary absence
  check with permanent invariants: root `src/` must not import it; the root manifest must gain no
  Material runtime, peer, or optional dependency; root runtime and type exports must expose no
  Material API; and root bundles and declarations must contain no MCU or Material implementation
  leakage. Do not weaken or delete the boundary protection; `scripts/check-api.ts` must continue to
  protect the root package.

## The headline feature

TokenOrigin / provenance. After generation + authored overrides, answering
"which of my public roles are still generated defaults?" is unanswerable in every competing tool. Surface it
deliberately.
