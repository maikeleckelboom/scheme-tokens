# Roadmap

`scheme-tokens` 0.1.0 is focused on the dependency-light core package, ordered token layers, CSS variable export,
deterministic serialization, strict schemas, and the real Material 3 source adapter.

Standards and ecosystem interoperability are planned, but DTCG support is not part of 0.1.0. Texel-backed color
conversion is also planned, but Texel runtime support is not part of 0.1.0.

Target framework output is planned, but shadcn runtime support is not part of 0.1.0.

Planned package names:

- DTCG format adapter: `@scheme-tokens/format-dtcg`;
- Texel conversion adapter: `@scheme-tokens/conversion-texel`;
- shadcn target adapter: `@scheme-tokens/target-shadcn`.

## 0.1.0 Scope

0.1.0 includes:

- strict `TokenGraphInput`, `TokenLayerInput`, and `CompiledScheme` contracts;
- JSON-safe helper input through `defineTokenGraph()` and `defineTokenLayer()`;
- `buildScheme()` for source-only, layer-only, and source-plus-layer builds;
- deterministic source/layer composition;
- unprefixed CSS variable export by default;
- structured CSS variable blocks through `exportCssVariableBlocks()`;
- deterministic compiled-scheme serialization;
- strict schema artifacts for core wire formats;
- `@scheme-tokens/source-material3` as the first real source adapter.

## 0.1.0 Exclusions

0.1.0 does not include:

- DTCG parser, exporter, resolver, or package runtime code;
- Texel conversion, gamut mapping, color math, or package runtime code;
- shadcn target mapping, scaffold export, validation, or package runtime code.

## Adapter Categories

Source adapters generate `TokenGraphInput` from an engine or provider and may expose `TokenSource` helpers.

Format adapters import or export external file or wire formats, such as DTCG.

Conversion adapters perform explicit color conversion, gamut mapping, color math, or engine-backed transformations. Texel
belongs to conversion adapters, not source adapters and not format adapters.

Target adapters map compiled or core token material into a target framework or design-system contract and may export
target-specific scaffolds. shadcn belongs to target adapters, not source adapters, format adapters, conversion adapters,
or Material 3 features.

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
      dark: { colorSpace: "display-p3", r: 0.08, g: 0.07, b: 0.1 },
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

The planned DTCG adapter package is `@scheme-tokens/format-dtcg`.

Initial DTCG v1 scope:

- color tokens only;
- one DTCG document per mode;
- `dtcgSource()` as the first import surface;
- `exportDtcgDocuments(compiled)` as the first export surface from `CompiledScheme`;
- strict key mapping by default;
- no silent slugification;
- unsupported DTCG color spaces fail with `Result` issues;
- metadata maps through `description`, `deprecated`, and `extensions`.

`dtcgLayer()` is deferred. `TokenLayerInput` does not own modes, so a layer-only multi-mode DTCG import cannot establish
light and dark modes by itself. Layer-only multi-mode builds use the `buildScheme({ modes, defaultMode, layers })`
envelope; DTCG import needs adapter-owned mapping before exposing a layer helper.

`exportDtcgDocuments(compiled)` should export resolved values from compiled schemes. Alias-preserving graph export is
deferred because compiled schemes do not preserve the original authored expression as the primary artifact.

## Deferred Standards Work

Deferred until after `@scheme-tokens/format-dtcg` exists:

- DTCG Resolver support;
- non-color DTCG token types;
- Style Dictionary integration;
- Tokens Studio integration;
- Terrazzo integration;
- tool-specific import and export behavior.

Color-space conversion for unsupported DTCG spaces is also deferred until a dedicated conversion adapter exists. Until
then, unsupported spaces should fail through adapter-owned `Result` issues instead of being approximated.

## Planned Texel Conversion Adapter

`@scheme-tokens/conversion-texel` is planned, not implemented.

It should depend on the upstream engine package `@texel/color` inside the adapter package only. Do not use
`@texel/colors`. The root `scheme-tokens` package must remain free of `@texel/color`.

Conversion and gamut mapping should be explicit operations, never silent behavior in core compilation or CSS export.
`@scheme-tokens/conversion-texel` should export scoped function names because the package import path already owns
the Texel context. The likely first operations are:

- `convertColor(input)` for one color;
- `mapGamut(input)` for one explicit gamut-mapping operation;
- `projectScheme(input)` for projecting a compiled scheme into a target delivery color space or gamut.

Unsupported spaces, non-finite output, and out-of-gamut RGB results should return adapter-owned `Result` issues rather
than silently clipping. Default out-of-gamut RGB behavior should fail, not map or clip. Gamut mapping must never be
silent.

Core `ColorValue` remains limited to the core-supported color spaces until a deliberate core API change is made.

Planned scheme projection should be explicit and auditable:

```ts
const projected = projectScheme({
  scheme: built.value.compiled,
  to: "display-p3",
  gamut: {
    behavior: "map",
    target: "display-p3",
    mapping: "map-to-cusp-l",
  },
});
```

Projected output should include:

- projected `CompiledScheme`;
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

`@scheme-tokens/target-shadcn` is planned, not implemented.

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
`material3.surface`, and `material3.surface-container`. Do not use old shorthand such as `m3.primary` or camelCase
Material role keys in docs.

`exportShadcnCss()` may emit target-specific scaffold pieces such as `@theme inline`, `:root`, `.dark`, and radius
variables. Scaffold pieces must be configurable because many shadcn projects already own parts of their global CSS.

Radius is not a color token in this package. If `@scheme-tokens/target-shadcn` later emits radius, it should be an
`exportShadcnCss()` option such as `radius: "0.625rem"`. Do not add radius to the core color token graph.

`validateShadcnTarget()` should report missing required shadcn tokens and risky mappings before any automatic repair is
considered.

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
