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

- `@scheme-tokens/source-*` contributes source graph material before build. Example:
  `@scheme-tokens/material3`.
- `@scheme-tokens/conversion-*` performs explicit post-compile color conversion, gamut mapping, color math, or
  projection. Planned example: `@scheme-tokens/conversion-texel`.
- `@scheme-tokens/target-*` maps compiled or core token material into a framework or design-system target contract.
  Planned example: `@scheme-tokens/target-shadcn`.
- `@scheme-tokens/format-*` imports or exports external file or wire formats. Planned example:
  `@scheme-tokens/format-dtcg`.

The intended composed workflow is:

```text
source adapters
+ authored token layers
+ target mapping layers
-> buildScheme()
-> optional conversion projection
-> sibling exports
```

Sibling exports consume the same compiled or projected scheme instead of depending on each other. Examples include CSS
variables from core, shadcn CSS from a target adapter, DTCG documents from a format adapter, and serialized compiled
schemes from core.

Do not model adapters as a transitive chain such as:

```text
Material -> Texel -> shadcn -> DTCG
```

That shape creates hidden transitive adapter dependencies and makes downstream adapters depend on each other's artifacts.
Source generation, conversion projection, target export, format export, and core export stay separate explicit steps.

## Source Adapters

Source adapters generate `TokenGraphInput` from an engine or provider and may expose `TokenSource` helpers for
`buildScheme(source)` or `buildScheme({ base: source })`. Applications may add authored layers with
`buildScheme(source, { layers })` or `buildScheme({ base: source, layers })`; those layers compose after source output
and may override source tokens.

```ts
interface TokenSource<I extends Issue = Issue> {
  readonly id: string;
  build(): Result<TokenGraphInput, I>;
}
```

`TokenSource` is structural. A source object may include metadata beyond `id` and `build`; core validates those two
members and invokes `build()` with the original source object as the receiver.

Source adapter factories should use plain names such as `material3(input)`. They return strict core graph input and
report recoverable failures with adapter-owned issue types.

For a minimal fixed source, the implementation can be structural:

```ts
import {
  defineTokenGraph,
  type Result,
  type TokenGraphInput,
  type TokenSource,
} from "scheme-tokens";

const staticSource: TokenSource = {
  id: "static",
  build(): Result<TokenGraphInput<"light" | "dark">> {
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

Conversion adapters perform explicit color conversion, gamut mapping, color math, or engine-backed transformations. They
are separate operations, not `TokenSource` objects by default. They should export verb-based functions such as
`convertColor(input)`, `mapGamut(input)`, and `projectScheme(input)` from their package root and return `Result` with
adapter-owned issues.

Conversion output may be package-specific JSON-safe data or an explicit core artifact. If it claims to be a core graph,
layer, or compiled scheme, it must satisfy the matching core parser and schema contract.

Texel belongs to conversion adapters, not source adapters or format adapters. Future Texel support belongs in
`@scheme-tokens/conversion-texel` and should depend on the upstream engine package `@texel/color` inside that
adapter package only. Do not use `@texel/colors`.

High-gamut authoring is not a Texel feature. Core already supports canonical color values in `srgb`, `display-p3`, and
`oklch`, and high gamut should be modeled as token values rather than as fake modes such as `light-p3` or `dark-p3`.
Texel should be used later only for explicit, auditable conversion, gamut mapping, or compiled scheme projection.
`projectScheme()` should project a `CompiledScheme`; it should not replace source or target layers. Gamut mapping must
never be silent; default out-of-gamut RGB behavior should fail instead of mapping or clipping.

## Format Adapters

Format adapters import or export external file and wire formats, such as DTCG. They are separate packages because
external format rules, naming, metadata, aliases, and validation diagnostics are not core graph behavior.

A format adapter may expose source helpers, conversion functions, and exporters when the external format is
bidirectional. For example, planned DTCG support belongs in `@scheme-tokens/format-dtcg`, not in the root package,
because DTCG can be both an import format and an export format.

Format adapters must keep public inputs and outputs JSON-safe and return recoverable failures through `Result` with
adapter-owned issue codes. Outputs that claim to be `TokenGraphInput`, `TokenLayerInput`, or `CompiledScheme` must
validate through the matching core parser and schema contract.

External format token names do not change the core token-key language. Core token keys remain dot-separated lower-kebab
identifier segments. Format adapters own any strict mapping, preservation, or diagnostic reporting for external names;
they must not rely on core silently slugifying names.

DTCG remains planned format adapter scope. A future `dtcgSource()` may import DTCG material as a source helper before
`buildScheme()`, and a future `exportDtcgDocuments(compiled)` may export from a `CompiledScheme`. A `dtcgLayer()` helper
remains deferred because `TokenLayerInput` does not own modes. External DTCG names are adapter-owned mapping concerns and
must not loosen core token-key validation.

## Target Adapters

Target adapters map compiled or core token material into a target framework or design-system contract. They may export
target-specific scaffolds when the target owns more than a plain token map.

The planned shadcn target adapter belongs in `@scheme-tokens/target-shadcn`. Do not use
`scheme-tokens/targets/shadcn`, do not add a root subpath export, and do not expose shadcn helpers from the root
package.

Target adapters must keep mapping explicit and overridable. They must not pretend that Material 3 roles, or any other
source roles, naturally equal target-specific tokens. For shadcn, a later `shadcnLayer()` should be source-agnostic, and a
later `material3ShadcnLayer()` may only map known `material3.*` token keys into the `shadcn.*` target contract.

Target graph namespaces still use core-valid token keys. The shadcn namespace should use lower-kebab keys such as
`shadcn.card-foreground`, `shadcn.primary-foreground`, `shadcn.sidebar-primary-foreground`, and `shadcn.chart-1`.
CamelCase adapter option fields may exist later for TypeScript ergonomics, but they must normalize to canonical graph
keys internally.

Target exporters must validate target readiness against the compiled scheme before emitting target output. For shadcn,
`validateShadcnScheme()` should validate required token presence by exported mode, color value presence, missing required
target tokens, invalid target contract mappings, CSS variable collisions, and mode-specific absence where relevant.
`exportShadcnCss()` should run that validation internally for ergonomic one-call use. Normal missing-token and mapping
failures return `Result` issues, not thrown exceptions.

For planned shadcn, `shadcnLayer()` may create or map target contract tokens directly. `material3ShadcnLayer()` may help
create `shadcn.*` target tokens from known `material3.*` roles, but it must not claim Material 3 roles naturally equal
shadcn tokens.

Target adapters export declared contracts, not namespaces. Base shadcn tokens are target-owned. Known optional modules
such as sidebar or charts are target-owned explicit module selections. User-defined target contract extensions are
consumer-owned and must be declared explicitly. Recommended future shape:

```ts
const commandExtension = defineShadcnExtension({
  id: "command-menu",
  variables: {
    "--command-background": {
      token: "app.command.background",
      required: true,
    },
    "--command-accent": {
      token: "app.command.accent",
      required: false,
    },
  },
});

const css = exportShadcnCss(scheme, {
  extensions: [commandExtension],
});
```

Custom extension token keys must still be valid core token keys, but they should not be forced under `shadcn.*`.
App-specific tokens may live under `app.*`, `brand.*`, `component.*`, or another explicit core-valid namespace. The
extension maps those tokens into target CSS variable names. Required extension tokens must exist for exported modes;
optional extension tokens may be omitted when absent. CSS variable collisions must be reported, not silently overwritten.
Exporters must not export every `shadcn.*`, `app.*`, or matching namespace token by default. Future namespace scanning may
be considered only as explicit opt-in and is not 0.1.0 scope.

## Dependency Rules

- Adapter packages may depend on engines.
- The root package must not depend on Material 3, Texel, image, canvas, CSS parser, or conversion engines.
- Adapters should depend on `scheme-tokens` as a peer dependency and dev dependency, not as a normal runtime
  dependency.
- Core must not import adapter packages.

Material 3 dependencies belong to `@scheme-tokens/material3`. Texel dependencies belong to future
`@scheme-tokens/conversion-texel`. DTCG format behavior belongs to future
`@scheme-tokens/format-dtcg`. shadcn target behavior belongs to future
`@scheme-tokens/target-shadcn`.

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

- `@scheme-tokens/material3` creates a `TokenSource` from a strict hex Material `sourceColor` and emits
  `light` / `dark` graph tokens under a lower-kebab source id namespace. The adapter public field remains
  `sourceColor`.
- Material extended colors are adapter-owned behavior exposed as `extendedColors`, with entries shaped as
  `{ name, color, harmonize? }`. Engine-specific option names stay internal.
- Key-color-driven Material schemes are future advanced scope only and require a clear, official, tested engine path
  before becoming public API.
