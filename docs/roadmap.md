# Roadmap

`scheme-tokens` 0.1.0 is focused on the dependency-light core package, ordered token layers, CSS custom-property export,
deterministic serialization, strict schemas, and the real Material 3 base scheme adapter.

Standards and ecosystem interoperability are planned, but DTCG support is not part of 0.1.0. Texel-backed color
conversion is also planned, but Texel runtime support is not part of 0.1.0.

Target framework output is planned, but shadcn runtime support is not part of 0.1.0.

Planned package names:

- DTCG format adapter: `@scheme-tokens/dtcg`;
- Texel color conversion adapter: `@scheme-tokens/texel`;
- shadcn target adapter: `@scheme-tokens/shadcn`.

## 0.1.0 Scope

0.1.0 includes:

- strict `ColorTokenGraphInput`, `ColorTokenLayerInput`, and `CompiledColorScheme` contracts;
- JSON-safe helper input through `defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()`;
- `buildScheme()` for base-only, layer-only, base-plus-layer builds, and base-first convenience calls;
- deterministic source/layer composition;
- unprefixed CSS custom-property export by default;
- structured CSS custom-property blocks through `exportCssVars()`;
- deterministic compiled-scheme serialization;
- strict schema artifacts for core wire formats;
- `@scheme-tokens/material3` as the first real Material 3 base scheme adapter.

## 0.1.0 Exclusions

0.1.0 does not include:

- DTCG parser, exporter, resolver, or package runtime code;
- Texel conversion, gamut mapping, color math, or package runtime code;
- shadcn target mapping, scaffold export, validation, or package runtime code.

## Adapter Categories

Source adapters generate `ColorTokenGraphInput` from an engine or provider and may expose `ColorTokenSource` helpers. Source
packages use `@scheme-tokens/*`; the current example is `@scheme-tokens/material3`.

Conversion adapters perform explicit post-compile color conversion, gamut mapping, color math, or projection.
The planned Texel package is `@scheme-tokens/texel`. Texel belongs to conversion adapters, not source adapters and not
format adapters.

Target adapters map compiled or core token material into a target framework or design-system contract and may export
target-specific scaffolds. shadcn belongs to target adapters, not source adapters, format adapters, conversion adapters,
or Material 3 features. The planned shadcn package is `@scheme-tokens/shadcn`.

Format adapters import or export external file or wire formats, such as DTCG. Format packages use
plain package names such as `@scheme-tokens/dtcg`.

These lanes can participate in one workflow, but they are not one transitive chain. The intended model is:

```text
source adapters
+ authored token layers
+ app-token mapping layers
+ target mapping layers
-> buildScheme()
-> optional conversion projection
-> sibling exports
```

Sibling exports may include core CSS variables, shadcn CSS from a target adapter, DTCG documents from a format adapter,
and core serialized compiled schemes. This is not the intended model:

```text
Material -> Texel -> shadcn -> DTCG
```

That chain would hide adapter dependencies and make downstream adapters depend on each other's artifacts.

## Planned Combined Workflow

The following is a future API sketch. It is not executable in 0.1.0 and does not mean the planned packages exist today.
It shows the intended composition shape using current scheme vocabulary:

```text
application layer
+ app-token mapping layer
+ future target mapping layer
+ material3({ sourceColors: "#6750a4" }, { defaultVisibility: "internal" })
-> buildScheme()
-> future optional conversion projection
-> sibling exports: core CSS, future shadcn CSS, future DTCG documents, serialized scheme
```

The important part is the shape: Material source material, application-owned layer material, and target mapping layers
compose before `buildScheme()`. Optional conversion projection operates on a `CompiledColorScheme`. CSS variables, shadcn CSS,
DTCG documents, and serialized compiled JSON are sibling exports from the compiled or projected scheme.

## High-Gamut Doctrine

High-gamut is native token value capability. Texel is explicit conversion and projection capability.

Core already supports canonical color values in `srgb`, `display-p3`, and `oklch`. Texel is not required for high-gamut
authoring. Texel is useful later for explicit conversion, gamut mapping, and compiled scheme projection.

Do not model high gamut as modes. This is the wrong shape:

```ts
defineTokenGraph({
  modes: ["light", "dark", "light-p3", "dark-p3"],
  defaultMode: "light",
  tokens: {},
});
```

Real theme modes stay `light` and `dark`. Each token value may use `srgb`, `display-p3`, or `oklch`:

```ts
defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      light: "#ffffff",
      dark: { colorSpace: "display-p3", components: [0.08, 0.07, 0.1], alpha: 1 },
    },
  },
});
```

## Canonical Core Keys

Core token keys remain dot-separated lower-kebab identifier segments such as `background`, `primary-foreground`,
`brand.primary`, and `material3.on-primary`.

External format names, including DTCG token names, are external format names. They may not match core token keys.
Adapters should preserve or report external naming through adapter-owned mapping and diagnostics. Core should not loosen
its token-key validation and should not silently slugify external names.

## Planned DTCG v1 Adapter

The planned DTCG format adapter package is `@scheme-tokens/dtcg`.

Initial DTCG v1 scope:

- color tokens only;
- one DTCG document per mode;
- `dtcgSource()` as the first import surface;
- `exportDtcgDocuments(compiled)` as the first export surface from `CompiledColorScheme`;
- strict key mapping by default;
- no silent slugification;
- unsupported DTCG color spaces fail with `Result` issues;
- metadata maps through `description`, `deprecated`, and `extensions`.

`dtcgLayer()` is deferred. `ColorTokenLayerInput` does not own modes, so a layer-only multi-mode DTCG import cannot establish
light and dark modes by itself. Layer-only multi-mode builds use the `buildScheme({ modes, defaultMode, layers })`
envelope; DTCG import needs adapter-owned mapping before exposing a layer helper.

`exportDtcgDocuments(compiled)` should export resolved values from compiled schemes. Alias-preserving graph export is
deferred because compiled schemes do not preserve the original authored expression as the primary artifact.

DTCG participates on both sides of the core build pipeline: `dtcgSource()` can produce source material before
`buildScheme()`, and `exportDtcgDocuments(compiled)` can export after build. External DTCG names remain adapter-owned
mapping concerns and must not loosen core token-key validation.

## Deferred Standards Work

Deferred until after `@scheme-tokens/dtcg` exists:

- DTCG Resolver support;
- non-color DTCG token types;
- Style Dictionary integration;
- Tokens Studio integration;
- Terrazzo integration;
- tool-specific import and export behavior.

Color-space conversion for unsupported DTCG spaces is also deferred until a dedicated conversion adapter exists. Until
then, unsupported spaces should fail through adapter-owned `Result` issues instead of being approximated.

## Planned Texel Conversion Adapter

`@scheme-tokens/texel` is planned, not implemented.

It should depend on the upstream engine package `@texel/color` inside the adapter package only. Do not use
`@texel/colors`. The root `scheme-tokens` package must remain free of `@texel/color`.

Conversion and gamut mapping should be explicit operations, never silent behavior in core compilation or CSS export.
`@scheme-tokens/texel` should export scoped function names because the package import path already owns
the Texel context. The likely first operations are:

- `convertColor(input)` for one color;
- `mapGamut(input)` for one explicit gamut-mapping operation;
- `projectScheme(input)` for projecting a `CompiledColorScheme` into a target delivery color space or gamut.

Unsupported spaces, non-finite output, and out-of-gamut RGB results should return adapter-owned `Result` issues rather
than silently clipping. Default out-of-gamut RGB behavior should fail, not map or clip. Gamut mapping must never be
silent.

Core `ColorValue` remains limited to the core-supported color spaces until a deliberate core API change is made.

Planned scheme projection should be explicit and auditable:

```text
project a compiled scheme to display-p3 with explicit gamut mapping policy
```

Projected output should include:

- projected `CompiledColorScheme`;
- JSON-safe conversion records per token and mode;
- from space;
- to space;
- `inGamut`;
- `mapped`;
- target gamut where applicable;
- mapping strategy where applicable.

Deferred Texel-adjacent work:

- deltaE;
- interpolation;
- palette generation;
- image extraction;
- DTCG integration;
- serializer wrappers.
- unsupported non-core output spaces.

## Planned shadcn Target Adapter

`@scheme-tokens/shadcn` is planned, not implemented.

It is a target adapter. It should map compiled or core token material into shadcn's fixed CSS-variable contract. Do not
use `scheme-tokens/targets/shadcn`, do not add a root subpath export, and do not expose shadcn helpers from the root
package.

The shadcn target graph namespace must use core-valid lower-kebab token keys, such as:

- `shadcn.background`;
- `shadcn.foreground`;
- `shadcn.card-foreground`;
- `shadcn.primary-foreground`;
- `shadcn.sidebar-primary-foreground`;
- `shadcn.chart-1`.

Do not use camelCase graph keys such as `shadcn.cardForeground` or `shadcn.chart1`. If a future adapter API accepts
camelCase option fields for TypeScript ergonomics, those fields must normalize to canonical lower-kebab graph keys
internally. Core token-key validation must not be loosened for shadcn.

`shadcnLayer()` should be source-agnostic. Mapping must be explicit and overridable because shadcn tokens are a target
contract, not a natural synonym set for any source system.

`material3ShadcnLayer()` may be a convenience policy later, but it should only map known `material3.*` token keys into
the `shadcn.*` target contract. Use current Material source keys such as `material3.primary`, `material3.on-primary`,
`material3.surface`, and `material3.surface-container`. Use lower-kebab Material role keys in docs.

`exportShadcnCss()` may emit target-specific scaffold pieces such as `@theme inline`, `:root`, `.dark`, and radius
variables. Scaffold pieces must be configurable because many shadcn projects already own parts of their global CSS.

Radius is not a color token in this package. If `@scheme-tokens/shadcn` later emits radius, it should be an
`exportShadcnCss()` option such as `radius: "0.625rem"`. Do not add radius to the core color token graph.

`validateShadcnScheme()` should report missing required shadcn tokens and risky mappings before any automatic repair is
considered.

Target readiness must be validated against the compiled scheme before target output is emitted. The planned validator
name is `validateShadcnScheme()`. It should check required token presence by exported mode, color value presence, missing
required target tokens, invalid target contract mappings, CSS variable collisions, and mode-specific absence where
relevant. `exportShadcnCss()` should validate internally for ergonomic one-call use. Normal missing-token failures return
`Result` issues, not thrown exceptions.

Target adapters export declared contracts, not namespaces. Base shadcn tokens are target-owned. Known optional modules
such as sidebar or charts are target-owned explicit module selections. User-defined target contract extensions are
consumer-owned and should be declared explicitly:

```text
define a command-menu extension with explicit variable-to-token mappings
export shadcn CSS with that declared extension
```

Custom extension token keys must still be valid core token keys. They should not be forced under `shadcn.*`; app-specific
tokens may live under `app.*`, `brand.*`, `component.*`, or another explicit core-valid namespace. The extension maps
those tokens into target CSS variable names. Required extension tokens must exist for exported modes. Optional extension
tokens may be omitted when absent. CSS variable collisions must be reported, not silently overwritten. Exporters must not
export every `shadcn.*`, `app.*`, or matching namespace token by default. Future namespace scanning may be considered
only as explicit opt-in and not for 0.1.0.

Chart tokens are categorical colors, not simple role aliases. Chart defaults are provisional unless explicitly mapped or
validated.

Deferred shadcn-adjacent work:

- chart palette generation;
- automatic contrast repair;
- OKLCH-native export;
- visual previews;
- registry item generation;
- theme gallery;
- framework integration;
- radius-as-token support.
