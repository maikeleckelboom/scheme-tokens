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
- Issue codes and their JSON Pointer paths
- The wire format / formatVersion Treat these as public API even though they are not types.

The package is published, so a change to any of the above needs a changeset and ships as a minor bump while the line is
below 1.0. A TypeScript declaration change also needs an API snapshot diff. The snapshot gate cannot detect behavioural
changes such as ordering when declarations remain unchanged, so review and policy own those cases. A changed contract
never ships as an alias next to the old shape.

## Settled decisions — do not re-propose

- Modes are a FLAT list. First-class orthogonal axes (palette x scheme) were evaluated and rejected: formatVersion 2,
  three schema rewrites, ~400 lines, broken pointer contract. docs/application-theme-coordinates.md prescribes
  flattening at the application boundary. Keep it.
- Bare strings are NEVER references. References are explicit, including the reference parts of a flat concat.
- Gamut and color space are APPLICATION concerns, not token concerns. Core never learns what sRGB or P3 are.
- [ADR 0013](./adr/0013-coherent-token-model.md) (accepted) designs the next breaking release as one contract:
  authoring, composition, visibility, static typing, layer mode sets, compiled provenance, CSS activation, wire-format
  evolution, schema identity, and TypeScript support. ADRs 0010–0012 are its accepted slices. Read it before proposing
  a change to any of these. The branch implements P2 runtime/wire, P3 static typing, P4 CSS activation, P4a `var()` output, and P5 Material layer/mode mapping. Durable docs describe this candidate. P6 external consumer migration and P7 final release preparation remain deferred, with committed/released package versions unchanged.
- P4a links only direct targets in the compiled scheme's actual emitted key set, regardless of visibility or naming success, and reuses actual names built once. Resolved output stays the default. Complete alias declarations enable local propagation; unmarked descendants inherit already-computed aliases. Concat projection is CSS token substitution, not arbitrary character assembly. Safety checks the complete projected value, not isolated fragments or unused resolved/fallback strings. The compiled parser proves structure without metadata consistency or acyclicity; P4a does not recompile edited metadata. See the [CSS guide](../docs-site/guide/export-css-variables.md#reference-output) and [diagnostics](./diagnostics.md#css-export) for the boundaries.
- [ADR 0015](./adr/0015-concat-mode-disambiguation.md) supersedes only the reserved-mode rule for `concat`. Exact singleton array shape distinguishes concat expressions from mode maps. This preserves valid published v1 source with mode `concat` and D10 retention. Never classify by property presence alone, including in the static model.

## Material 3 adapter package

- [ADR 0005](./adr/0005-material3-adapter-package-boundary.md) owns the optional package
  boundary and licensing; [ADR 0007](./adr/0007-material3-engine-and-role-contract.md) owns the pinned
  engine, accepted roles and capabilities. P5 implements [ADR 0014](./adr/0014-material3-layer-and-mode-mapping.md),
  superseding the listed parts of ADR 0006, all of ADR 0008, and ADR 0005's old named type list.
  Material returns one fixed-id layer, with an exact non-empty modes map and custom `colorMode`.
  The positional source is the only global source; spec and visibility remain global. Effective
  source/variant/contrast coordinates are validated before engine generation. Core validates names
  through a narrow empty-envelope preflight and the generated layer directly; its errors propagate unchanged.
- Current P3 visibility facts refine ADR 0014's prototype: generated declarations omit visibility,
  so all 48 roles appear in `omitted`, with `public`/`internal` both `never`. Preserve that fact and
  core's nominal proof. NoInfer prevents modes and default visibility being supplied by return
  context. Unknown visibility keeps public output partial over all keys, including possibly public
  roles. Bare Material3Options is deliberately wider than the default call.
- Material's intentional snapshot and minor changeset describe the breaking API. Its peer is
  `^0.4.0` alone; the shared temporary candidate helper proves `0.4.0`/`0.2.0` with strict peers,
  raw Node ESM and NodeNext runtime. The authoritative type cases are copied into that consumer and
  run under strict-only and stricter settings with SCHEME_TOKENS_TSC_PATH from both blocking
  compiler roles (deduplicated when equal). Next stays a non-blocking signal.
- `packages/material3` is the active production package and sole current adapter authority. Its
  package-local runtime, type, engine, golden, API, tarball, licensing, and packed-consumer gates
  reproduce the accepted phase-1 evidence against the real package.
- `tests/rnd/material3` is frozen historical phase-1 evidence retained for immutable ADR links. It
  is not a pnpm workspace, does not regenerate fixtures, and does not participate in validation.
- Core remains Material-free. The root boundary test and `scripts/check-api.ts` assert that root
  source, dependencies, runtime exports, type exports, bundle, declarations, and package subpaths
  contain no adapter or engine implementation leakage.

## The headline feature

TokenOrigin / provenance. After generation + authored overrides, answering
"which of my public roles are still generated defaults?" is unanswerable in every competing tool. Surface it
deliberately.
