# Public API

The root API is intentionally small and explicit.

## Runtime Exports

- `defineTokenGraph`
- `defineTokenFragment`
- `parseTokenGraph`
- `parseColor`
- `compileTokenGraph`
- `buildTokenSet`
- `exportCssVariables`
- `exportCssVariableBlocks`
- `serializeTokenSet`
- `formatCssColor`

## Package Subpaths

The package exports only:

- `.`
- `./schemas/token-graph.v1.schema.json`
- `./schemas/token-fragment.v1.schema.json`
- `./schemas/compiled-token-set.v1.schema.json`
- `./package.json`

There are no core conversion, Material, source adapter, or engine subpaths.

## Ordinary Flow

For manual colors:

1. Use `defineTokenGraph()` to author a graph.
2. Use `compileTokenGraph()` to validate and resolve the selected tokens.
3. Use `exportCssVariables()` for CSS, `exportCssVariableBlocks()` for structured declarations, or
   `serializeTokenSet()` for deterministic compiled JSON.

`compileTokenGraph()` defaults to `selection: "public"`. The CSS exporter emits variables for the compiled token set it
receives; it does not apply visibility filtering itself.

`exportCssVariables()` returns a CSS stylesheet string. `exportCssVariableBlocks()` returns one structured block per
compiled mode, preserving the CSS model as `{ mode, selector, declarations }` for runtime application, previews, or
custom renderers.

`prefix` is optional. Omitting it, passing `undefined`, or passing `""` emits unprefixed custom properties such as
`--background` and `--primary-foreground`. Passing `prefix: "color"` emits namespaced properties such as
`--color-background` and `--color-brand-primary`. Dot-separated token keys flatten with hyphen separators, so
`material3.primary` exports as `--material3-primary` without a prefix or `--color-material3-primary` with
`prefix: "color"`.

External CSS variable contracts can be supported by authoring matching token keys and exporting without a prefix. Core
does not hard-code framework presets or browser mutation behavior.

## Authoring Helpers

`defineTokenGraph()` and `defineTokenFragment()` are ergonomic authoring helpers. They default `formatVersion` to `1` and
`defaultVisibility` to `public`. `defineTokenGraph()` also defaults to one `base` mode when `modes` is omitted.

`base` is the single ordinary mode for simple graphs. It is not a generated scheme, Material role set, or hidden
light/dark decision.

Token shorthands are normalized by the helpers:

- `"token.key": "#ffffff"` becomes `{ value: "#ffffff" }`;
- `"token.key": "other.token"` becomes `{ value: { ref: "other.token" } }`;
- `"token.key": { ref: "other.token" }` becomes `{ value: { ref: "other.token" } }`;
- mode records such as `{ light: "#fff", dark: "#000" }` become `valueByMode` when modes are declared.

Supported color literals remain color values. Token-key-shaped non-color strings become references. This shorthand is
helper-only and is not accepted by `parseTokenGraph()`.

Declared mode names must not be token-definition keys such as `value`, `valueByMode`, `visibility`, `description`,
`deprecated`, or `extensions`. Those names are reserved so helper shorthand detection does not silently reinterpret token
definitions.

## Strict Wire Format

`parseTokenGraph()` accepts strict persisted graph input. Strict graph input spells out `formatVersion`, `modes`,
`defaultMode`, `defaultVisibility`, and token definitions with `value` or `valueByMode`.

Helper-only shorthand is intentionally not part of the strict wire format. Use `defineTokenGraph()` at authoring
boundaries and `parseTokenGraph()` at persistence or untrusted-input boundaries.

The schema subpaths validate strict persisted artifacts only: token graph input, token fragment input, and serialized
compiled token set output. They intentionally reject helper-only shorthand such as raw token color strings, raw
`{ ref }` token definitions, and mode records without `valueByMode`.

## Compiled Token Sets

`compileTokenGraph()` returns a compiled token set with resolved colors, modes, token visibility, origin metadata, and
direct dependency metadata. `serializeTokenSet()` serializes this compiled output in deterministic order. Compiled JSON
contains resolved color objects, not the original authored color strings.

## Adapter Sources

`TokenSource` is structural. Core accepts a safe source object with a valid string `id` and callable `build`, permits
extra adapter metadata, and invokes `build()` with the original source object as `this`.

`buildTokenSet()` is the adapter runner. It calls one or more `TokenSource` objects in array order, composes their graph
material before caller fragments, validates the result, and returns `{ graph, compiled }`. The `sources` option is
required and must be a non-empty array, even for a single source. The root package does not implement Material 3, Texel,
conversion, image, or CSS parser engines. Material 3 support lives in `@color-scheme-tokens/source-material3`, which
imports core only through the generic source contract.
