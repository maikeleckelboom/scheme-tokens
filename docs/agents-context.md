# Agent context — scheme-tokens

## What this package is

A COMPILER for design tokens, not a transformer. Style Dictionary and Terrazzo consume a format and emit platform files.
This compiles a token graph: layered composition, visibility enforcement, provenance, structured diagnostics,
deterministic output. Do not add platform transforms (Swift/Android/Sass) — that is Style Dictionary's ground and out of
scope.

## Hard boundaries (enforced, do not relax)

- Core owns NO color model. Token values are opaque strings. tests/unit/package-boundary.test.ts asserts parseColor is
  absent; scripts/check-api.ts fails the build if the bundle contains "material3".
- No filesystem access, no throw-based errors, JSON-safe inputs. The package must remain runnable in a browser — that is
  a deliberate differentiator.
- Zero runtime dependencies in core.

## Contractual surface (a change here is BREAKING)

- CSS declaration ordering and block ordering
- Serialization key ordering
- Issue codes (49) and their JSON Pointer paths
- The wire format / formatVersion Treat these as public API even though they are not types.

## Settled decisions — do not re-propose

- Modes are a FLAT list. First-class orthogonal axes (palette x scheme) were evaluated and rejected: formatVersion 2,
  three schema rewrites, ~400 lines, broken pointer contract. docs/application-theme-coordinates.md prescribes
  flattening at the application boundary. Keep it.
- Bare strings are NEVER references. tokenRef () or {ref} only.
- Gamut and color space are APPLICATION concerns, not token concerns. Core never learns what sRGB or P3 are.

## The headline feature

TokenOrigin / provenance. After generation + authored overrides, answering
"which of my public roles are still generated defaults?" is unanswerable in every competing tool. Surface it
deliberately.

## Git

Work on `dev`. Atomic, scoped commits per logical change. Preserve unrelated work. Do NOT push, force-push, reset, or
rewrite shared history. Report branch, SHA, message, and check status per commit.
