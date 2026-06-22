# Adapter Policy

Adapters are separate packages. The full package architecture is defined in
[`docs/adr/0002-adapter-package-architecture.md`](./adr/0002-adapter-package-architecture.md), with format adapter
rules in [`docs/adr/0003-format-adapter-packages.md`](./adr/0003-format-adapter-packages.md).

The repository ships `scheme-tokens`, the dependency-light core, and optional adapter packages under `packages/`.
The core package exports root runtime helpers and strict core schema subpaths only. Adapter packages are added only when
a real engine-backed capability is ready.

## Adapter Lanes and Pipeline

Adapter packages have different roles. They can participate in one workflow, but they must not all pretend to be the
same pipeline slot:

- Source adapter packages contribute source graph material before build. They use plain capability names when the package
  is primarily a source adapter, such as `@scheme-tokens/material3`, and only use a prefix when the package role needs
  disambiguation.
- `@scheme-tokens/texel` is the planned Texel conversion adapter for explicit post-compile conversion or projection.
- `@scheme-tokens/dtcg` is the planned DTCG format adapter for importing or exporting external DTCG file and wire
  formats.

The intended composed workflow is:

```text
source adapters
+ authored token layers
+ app-token mapping layers
-> buildScheme()
-> optional conversion projection
-> sibling exports
```

Sibling exports consume the same compiled or projected scheme instead of depending on each other. Examples include CSS
variables from core, DTCG documents from a format adapter, and serialized compiled schemes from core.

Do not model adapters as a transitive chain such as:

```text
Material -> Texel -> DTCG
```

That shape creates hidden transitive adapter dependencies and makes downstream adapters depend on each other's artifacts.
Source generation, conversion projection, format export, and core export stay separate explicit steps.

## Source Adapters

Source adapters generate `ColorTokenGraphInput` from an engine or provider and may expose `ColorTokenSource` helpers for
`buildScheme(source)` or `buildScheme({ base: source })`. Applications may add authored layers with
`buildScheme(source, { layers })` or `buildScheme({ base: source, layers })`; those layers compose after source output
and may override source tokens. App-owned public role names should be represented as layer `tokens` with explicit
references, not as adapter role keys exported directly.

```ts
interface ColorTokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<ColorTokenGraphInput, I>;
}
```

`ColorTokenSource` is structural. A source object may include metadata beyond `id` and `build`; core validates those two
members and invokes `build()` with the original source object as the receiver.

Source adapter factories should use plain names such as `material3(input)`. They return strict core graph input and
report recoverable failures with adapter-owned issue types.

For a minimal fixed source, the implementation can be structural:

```ts
import {
  defineTokenGraph,
  type Result,
  type ColorTokenGraphInput,
  type ColorTokenSource,
} from "scheme-tokens";

const staticSource: ColorTokenSource = {
  id: "static",
  build(): Result<ColorTokenGraphInput<"light" | "dark">> {
    return {
      ok: true,
      value: defineTokenGraph({
        modes: ["light", "dark"],
        defaultMode: "light",
        defaultVisibility: "internal",
        tokens: {
          "static.primary": {
            light: "#6750a4",
            dark: "#d0bcff",
          },
        },
      }),
    };
  },
};
```

This example is intentionally static: it demonstrates the source contract without implying that adapter authoring is a
branding-specific workflow. Engine-backed adapters should keep parsing, engine calls, and adapter-owned issue types inside
their own packages.

## Conversion Adapters

Conversion adapters perform explicit conversion, projection, or engine-backed transformations. They are separate
operations, not `ColorTokenSource` objects by default. They should export verb-based functions such as
`convertColor(input)` or `projectScheme(input)` from their package root and return `Result` with adapter-owned issues.

Conversion output may be package-specific JSON-safe data or an explicit core artifact. If it claims to be a core graph,
layer, or compiled scheme, it must satisfy the matching core parser and schema contract.

Texel belongs to conversion adapters, not source adapters or format adapters. Future Texel support belongs in
`@scheme-tokens/texel` and should depend on the upstream engine package `@texel/color` inside that
adapter package only. Do not use `@texel/colors`.

Texel should be used later only for explicit, auditable conversion or compiled scheme projection. `projectScheme()`
should project a `CompiledColorScheme`; it should not replace source layers.

## Format Adapters

Format adapters import or export external file and wire formats, such as DTCG. They are separate packages because
external format rules, naming, metadata, aliases, and validation diagnostics are not core graph behavior.

A format adapter may expose source helpers, conversion functions, and exporters when the external format is
bidirectional. For example, planned DTCG support belongs in `@scheme-tokens/dtcg`, not in the root package,
because DTCG can be both an import format and an export format.

Format adapters must keep public inputs and outputs JSON-safe and return recoverable failures through `Result` with
adapter-owned issue codes. Outputs that claim to be `ColorTokenGraphInput`, `ColorTokenLayerInput`, or `CompiledColorScheme` must
validate through the matching core parser and schema contract.

External format token names do not change the core token-key language. Core token keys remain dot-separated lower-kebab
identifier segments. Format adapters own any strict mapping, preservation, or diagnostic reporting for external names;
they must not rely on core silently slugifying names.

DTCG remains planned format adapter scope. A future `dtcgSource()` may import DTCG material as a source helper before
`buildScheme()`, and a future `exportDtcgDocuments(compiled)` may export from a `CompiledColorScheme`. A `dtcgLayer()` helper
remains deferred because `ColorTokenLayerInput` does not own modes. External DTCG names are adapter-owned mapping concerns and
must not loosen core token-key validation.

## Dependency Rules

- Adapter packages may depend on engines.
- The root package must not depend on Material 3, Texel, image, canvas, CSS parser, or conversion engines.
- Adapters should depend on `scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime
  dependency.
- Core must not import adapter packages.

Material 3 engine code belongs to `@scheme-tokens/material3`. Texel dependencies belong to future
`@scheme-tokens/texel`. DTCG format behavior belongs to future
`@scheme-tokens/dtcg`.

## Issue and Schema Rules

- Adapter public inputs should be JSON-safe plain data.
- Recoverable adapter failures use `Result` with non-empty `issues`.
- Adapter issue codes use adapter-owned namespaces such as `material3-*` or `texel-*`.
- Adapter issue codes and paths are adapter contracts and must not pretend to be core issue codes.
- Adapter input schemas are optional package-owned artifacts.
- Core schemas remain strict core artifacts only.

## Release Proofs

Every adapter must prove before release:

- root imports remain engine-free;
- adapter imports may load only the adapter-owned engines;
- a packed consumer can install and use core plus the adapter;
- reference-vector tests prove the real engine-backed behavior;
- Material 3 output, when shipped, comes from a real Material algorithm and is not approximated.

## Current Adapters

- `@scheme-tokens/material3` creates a `ColorTokenSource` from Material 3 generation input and emits `light` / `dark` graph
  tokens under a lower-kebab source id namespace.
- `sourceColors` is the canonical public source-color input. `material3("#6750a4")` is shorthand for
  `material3({ sourceColors: "#6750a4" })`. The canonical field accepts one strict `#rrggbb` string or an array of
  strict `#rrggbb` strings, and the array form maps to official upstream multi-source behavior while preserving order.
  Empty arrays fail at runtime validation.
- With object input, `variant`, `contrastLevel`, `specVersion`, `platform`, `paletteOverrides`, `extendedColors`, and
  `paletteTones` belong in the first `material3()` argument. `id` and `defaultVisibility` belong in the optional second
  argument. With shorthand input, the second argument is Material generation options and the third argument is integration
  options.
- Material extended colors are adapter-owned behavior exposed as `extendedColors`, with entries shaped as
  `{ name, color, harmonize?, description? }`. Engine-specific option names stay internal.
- Material role keys can differ by official `specVersion`; newer optional roles are emitted only when the selected
  upstream spec exposes them.
- The adapter vendors a pinned official Material Color Utilities TypeScript snapshot when the published npm package lags
  the required official main-branch behavior. Vendored internals remain package-private and must preserve upstream
  license provenance.
