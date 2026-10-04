---
"scheme-tokens": minor
"@scheme-tokens/material3": minor
---

Refine the candidate public API before stabilization. Material generation uses
`modeSettings` and `Material3ModeSettings`, with congruent explicit built-in
`colorMode` accepted. Compilation takes selection arrays, and the trusted graph
helper normalizes omitted graph-local tokens to an empty canonical record.

Expose `LayerVisibilityFacts` with explicit may-set fields. Compiled v2 declaration
metadata uses `declaredVisibility`; the parser and schema reject the old field.
Diagnostics are discriminated by code with emitter-guaranteed payloads;
`inconsistent-layer-modes` separates internally disagreeing maps from
`layer-mode-mismatch` against a graph. Selection issue paths use `/selection/<index>`.

Group CSS activation under `activation`, rename `system` to `media`, and use
`default`, `media`, `attribute`, and `selector` structured tiers. Attributes are
explicit opt-in, with `{ name, includeHost: true }` adding host targeting independently
of root. Selector activation accepts one condition object as well as strings and
lists; its malformed-condition code is `invalid-selector-condition`. No compatibility
aliases are retained. Core graph/layer wire formats and reference semantics remain unchanged.
