# Public API

The root API is intentionally small and explicit.

## Runtime Exports

- `defineTokenGraph`
- `defineTokenLayer`
- `defineTokens`
- `parseTokenGraph`
- `parseColor`
- `compileTokenGraph`
- `buildScheme`
- `createSchemeBuilder`
- `exportCssVars`
- `serializeScheme`
- `formatCssColor`

## Package Subpaths

The package exports only:

- `.`
- `./schemas/token-graph.v1.schema.json`
- `./schemas/token-layer.v1.schema.json`
- `./schemas/compiled-scheme.v1.schema.json`
- `./package.json`

There are no core conversion, Material, source adapter, or engine subpaths.

## Ordinary Flow

For manual colors:

1. Use `defineTokens()` for simple token-record authoring, or `defineTokenGraph()` for full graph-shaped authoring.
2. Use `compileTokenGraph()` to validate and resolve the selected tokens.
3. Use `exportCssVars()` for CSS and structured declarations, or `serializeScheme()` for deterministic compiled JSON.

`compileTokenGraph()` defaults to `selection: "public"`. The CSS exporter emits variables for the compiled scheme it
receives; it does not apply visibility filtering itself.

`exportCssVars()` returns one `Result` whose success value contains `css` and `blocks`. `css` is the serialized
stylesheet string. `blocks` contains one structured block per compiled mode, preserving the CSS model as
`{ mode, selector, declarations }` for runtime application, previews, or custom renderers. The stylesheet is formatted
from the same blocks returned in `value.blocks`.

`prefix` is optional. Omitting it, passing `undefined`, or passing `""` emits unprefixed custom properties such as
`--background` and `--primary-foreground`. Passing `prefix: "color"` emits namespaced properties such as
`--color-background` and `--color-brand-primary`. Dot-separated token keys flatten with hyphen separators, so
`material3.primary` exports as `--material3-primary` without a prefix or `--color-material3-primary` with
`prefix: "color"`.

External CSS variable contracts can be supported by authoring matching token keys and exporting without a prefix. Core
does not hard-code framework presets or browser mutation behavior.

## Tailwind v4 Boundary

Tailwind v4 integration is a CSS mapping step, not a root-package target exporter. `scheme-tokens` emits authored
runtime variables by default:

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

Tailwind's `--color-*` names belong in Tailwind's `@theme` contract:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Use an explicit color token list for this mapping. Do not derive Tailwind theme colors by blindly converting every CSS
variable declaration to `--color-*`, and do not treat `--color-*` as the default `scheme-tokens` runtime namespace.

## Token Keys

Core token keys use one canonical internal language: dot-separated lower-kebab identifier segments.

Valid examples include:

- `background`
- `primary-foreground`
- `brand.primary`
- `material3.on-primary`

Core `TokenGraphInput` and `TokenLayerInput` do not accept arbitrary camelCase, snake_case, PascalCase, spaces, or mixed
casing in token keys. The strict parser and JSON Schemas reject those names with contractual diagnostics instead of
normalizing them.

External file formats may have different token-name rules. Those external names are adapter-owned format concerns, not a
reason to loosen the core token-key language. Format adapters such as the planned
`@scheme-tokens/format-dtcg` should preserve external names or report mapping diagnostics through their own
contracts. Core does not silently slugify external names.

## Authoring Helpers

`defineTokens()`, `defineTokenGraph()`, and `defineTokenLayer()` are ergonomic authoring helpers. They default
`formatVersion` to `1` and `defaultVisibility` to `public`. Graph helpers also default to one `base` mode when `modes`
is omitted.

`defineTokens(tokens, options?)` is the simple token-record helper. It returns the same strict graph shape as
`defineTokenGraph({ ...options, tokens })`, while keeping token keys separate from graph-level fields such as `modes`,
`defaultMode`, `defaultVisibility`, `tokens`, `formatVersion`, and `$schema`.

`defineTokenGraph(input)` is the full graph helper. Its input remains graph-shaped and does not accept ambiguous flat
top-level token records.

`base` is the single ordinary mode for simple graphs. It is not a generated scheme, Material role set, or hidden
light/dark decision.

Token shorthands are normalized by the helpers:

- `"token.key": "#ffffff"` becomes `{ value: "#ffffff" }`;
- `"token.key": "other.token"` becomes `{ value: { ref: "other.token" } }`;
- `"token.key": { visibility: "public", value: "other.token" }` becomes a public reference token;
- `"token.key": { ref: "other.token" }` becomes `{ value: { ref: "other.token" } }`;
- metadata plus mode records such as `{ visibility: "public", light: "#fff", dark: "#000" }` become strict
  per-mode values when modes are declared.

Supported color literals remain color values. Token-key-shaped non-color strings become references. This shorthand is
helper-only and is not accepted by `parseTokenGraph()`.

Declared mode names must not be token-definition keys such as `value`, `valueByMode`, `visibility`, `description`,
`deprecated`, or `extensions`. Those names are reserved so helper shorthand detection does not silently reinterpret token
definitions.

## Strict Wire Format

`parseTokenGraph()` accepts strict persisted graph input. Strict graph input spells out `formatVersion`, `modes`,
`defaultMode`, `defaultVisibility`, and token definitions with `value` or `valueByMode`.

Helper-only shorthand is intentionally not part of the strict wire format. Use `defineTokens()` or
`defineTokenGraph()` at authoring boundaries and `parseTokenGraph()` at persistence or untrusted-input boundaries.

The schema subpaths validate strict persisted artifacts only: token graph input, token layer input, and serialized
compiled scheme output. They intentionally reject helper-only shorthand such as raw token color strings, raw
`{ ref }` token definitions, and mode records without `valueByMode`.

## Compiled Schemes

`compileTokenGraph()` returns a compiled scheme with resolved colors, modes, token visibility, origin metadata, and
direct dependency metadata. `serializeScheme()` serializes this compiled output in deterministic order. Compiled JSON
contains resolved color objects, not the original authored color strings.

## Base Inputs

`TokenSource` is structural. Core accepts a safe base input object with a valid string `id` and callable `build`,
permits extra adapter metadata, and invokes `build()` with the original source object as `this`.

`buildScheme()` is the adapter runner and layer composer. `buildScheme(options)` is the canonical explicit form.
`buildScheme(source)` and `buildScheme([sourceA, sourceB])` are base-only convenience forms. A second options argument
may provide build options except `base`, for example `buildScheme(source, { layers, selection })`.

`createSchemeBuilder(config)` prepares reusable build options except `base`. It is synchronous and immutable from the
caller's perspective: mutating the config object or layer array after creation does not change future builds. The
returned builder accepts:

- `builder.build()` for the same layer-only build behavior as `buildScheme(config)`;
- `builder.build(base)` for a source shorthand;
- `builder.build({ base })` for the explicit object form.

The builder is source-agnostic. Generic builder input uses the `base` property only. Material-specific fields such as
`sourceColors`, `variant`, `contrastLevel`, `specVersion`, `platform`, `palettes`, `extendedColors`, and `paletteTones`
belong inside `material3()` or another adapter helper, not on `builder.build()`.

Layers and build-envelope fields belong in the options object. Mixed source/layer positional arrays are intentionally
unsupported; use `buildScheme({ base, layers })` or `buildScheme(source, { layers })` instead.

The canonical options object accepts base-only, layer-only, and base-plus-layer input. `base` and `layers` are optional
fields, but at least one of them must be present and non-empty.

When `base` is an array, base inputs compose first in array order. Duplicate token keys across base inputs are invalid.
Layers compose after base inputs as ordered authored token overlays. Later layers win by token key, and a layer may
override a base token. References, missing-reference checks, and circular-reference checks run after final composition.
Winning token origin metadata points at the winning base input or layer.

Layer composition is not CSS cascade behavior. Core does not implement selector specificity, `!important`, CSS `@layer`,
DOM mutation, or runtime style injection.

The root package does not implement Material 3, Texel, conversion, image, or CSS parser engines. Material 3 support lives
in `@scheme-tokens/material3`, which imports core only through the generic source contract.

## Material 3 Adapter Package

`@scheme-tokens/material3` exports the package-specific `material3()` source helper. It is not a root subpath and it
does not make the root package load Material engine code.

The primary one-color API is shorthand for the canonical `sourceColors` field:

```ts
import { material3 } from "@scheme-tokens/material3";

const base = material3("#6750a4");
```

`sourceColors` remains the canonical config field. `material3("#6750a4")` normalizes to
`material3({ sourceColors: "#6750a4" })`. Object input owns Material 3 generation options:

```ts
const generated = material3(
  {
    sourceColors: ["#6750a4", "#00a88f"],
    variant: "cmf",
    specVersion: "2026",
    contrastLevel: 0.5,
    extendedColors: [{ name: "success", color: "#2e7d32", harmonize: true }],
  },
  {
    defaultVisibility: "internal",
  },
);
```

The canonical field accepts either a strict `#rrggbb` string or an array of strict `#rrggbb` strings. Empty arrays fail
at runtime validation. The array form maps to official upstream multi-source behavior for paths that use multiple source
colors, preserving source order.

With object input, the optional second argument is scheme-token integration policy:

```ts
const internalBase = material3(
  {
    sourceColors: ["#6750a4", "#00a88f"],
    variant: "cmf",
    specVersion: "2026",
  },
  {
    id: "brand-material",
    defaultVisibility: "internal",
  },
);
```

With shorthand input, the optional second argument is Material 3 generation options and the optional third argument is
integration policy:

```ts
const internalExpressiveBase = material3(
  "#6750a4",
  { variant: "expressive" },
  { defaultVisibility: "internal" },
);
```

`material3Preset(generationDefaults, integrationOptions?)` prepares repeated Material generation settings and returns a
source helper. Runtime calls still provide `sourceColors`:

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" }, { defaultVisibility: "internal" });

const base = material("#6750a4");
```

The returned preset helper also accepts runtime generation overrides and object input:

```ts
import { material3Preset } from "@scheme-tokens/material3";

const material = material3Preset({ variant: "tonal-spot" });

const expressiveBase = material("#6750a4", { variant: "expressive" });

const cmfBase = material(["#6750a4", "#00a88f"], {
  variant: "cmf",
  specVersion: "2026",
});

const objectBase = material({
  sourceColors: "#6750a4",
  variant: "expressive",
});
```

Runtime generation input wins over preset defaults. Arrays replace arrays; `extendedColors` entries are not concatenated
or deep-merged. Integration options are fixed at preset creation. Use a second preset or `material3()` directly when
`id` or `defaultVisibility` should differ.

`id` and `defaultVisibility` are integration options, not Material 3 generation input. `variant`, `contrastLevel`,
`specVersion`, `platform`, `palettes`, `extendedColors`, and `paletteTones` are Material 3 generation options, not
integration options. Removed or older option names are rejected instead of being treated as aliases.

Some newer Material role keys, including dim roles, are emitted only when the selected official `specVersion` exposes
them. Consumers should not assume every spec version has an identical role-key surface.

The package also exports narrow UI-oriented values and types: `material3Variants`, `material3SpecVersions`,
`material3Platforms`, `Material3Variant`, `Material3SpecVersion`, and `Material3Platform`.

## BuildSchemeOptions

`BuildSchemeOptions` accepts:

- `base?: TokenSource | readonly TokenSource[]`
- `layers?: readonly TokenLayerInput[]`
- `modes?: readonly [string, ...string[]]`
- `defaultMode?: string`
- `defaultVisibility?: "public" | "internal"`
- `selection?: TokenSelection`

At least one base input or layer is required.

`BuildSchemeSourceOptions` is `BuildSchemeOptions` without `base`. It is the second-argument type for source shorthand
calls.

When base inputs are present, the first base graph establishes the composed graph envelope. If `modes`, `defaultMode`, or
`defaultVisibility` are also provided to `buildScheme()`, they must match that first base graph or the call returns an
`invalid-build-options` issue. Explicit build options validate the expected base envelope; they do not override base
authority.

When no base input is present, `buildScheme()` uses `modes`, `defaultMode`, and `defaultVisibility` from the options to
create the composed graph envelope. If `modes` is omitted, the current simple layer-only behavior remains one `base` mode
with `defaultMode: "base"`. If `modes` is provided, `defaultMode` is required and must belong to `modes`.
`defaultVisibility` defaults to `public` when omitted.

Layers do not own the graph mode envelope. `TokenLayerInput` remains a mode-shaped contribution to a graph; use
`buildScheme({ modes, defaultMode, layers })` when a layer-only build needs light and dark modes.
