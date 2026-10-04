# @scheme-tokens/material3

## 0.2.0

### Minor Changes

- 649d349: Tie returned mode and visibility facts to supplied options. Non-default mode sets require
  `modeSettings`, and visibility types excluding public require `visibility`. Omitted or undefined
  options use a non-generic default-call signature; wrappers must narrow or default possibly
  undefined options before forwarding. Preserve literal inference, contextual NoInfer protection,
  and runtime generation defaults.
- b6c1da5: Return one validated mode-aware TokenLayer instead of a graph fragment. Compose with `layers: [material]` and declare the graph's modes/defaultMode explicitly. The exact, non-empty `modeSettings` map replaces additive `modes` and `exactModes`; custom graph modes require `colorMode`, replacing `appearance`. The positional source remains the only global source, with per-mode source/variant/contrast overrides validated before generation.

  Export Material3ColorMode, Material3ModeSettings and Material3Options, remove Material3Appearance and Material3GraphFragment, and preserve exact mode/visibility inference with NoInfer. Generated roles omit authored visibility, matching core's current LayerVisibilityFacts contract. The adapter now requires scheme-tokens ^0.4.0; earlier core minors are unsupported. Engine algorithms and 48-role output are unchanged.

- a35e122: Refine the candidate public API before stabilization. Material generation uses
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

### Patch Changes

- a86d217: Expand supported consumer compilers to `>=5.9.3 <6.0.0 || >=6.0.2 <7.0.0 || >=7.0.2 <8.0.0`.
  The authoritative core and full P5.1 Material matrices run against actual source and paired
  tarballs, with strict-only and stricter settings, skipLibCheck false and consumer declaration
  emission. The repository retains TypeScript 7 development tooling. Runtime behavior and
  declarations are unchanged. The existing pending minor changesets still project core 0.4.0
  and Material 0.2.0 with peer ^0.4.0; no primary-worktree versioning is applied.

## 0.1.1

### Patch Changes

- 2633955: Advertise compatibility with the scheme-tokens 0.3 release line and certify the packed candidate against it, while retaining the unchanged implementation's historically certified 0.2 support.

## 0.1.0

### Minor Changes

- 8211b63: Add the first public Material 3 adapter package with strict mode authoring, a bundled pinned
  Material Color Utilities engine, finite system-role types, and packed-consumer release proof.

### Patch Changes

- Updated dependencies [61690df]
- Updated dependencies [f047cc9]
- Updated dependencies [4fae915]
  - scheme-tokens@0.2.0
