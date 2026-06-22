# Public API

The root API is the dependency-light token graph and CSS-variable compiler. It does not own CSS color parsing,
formatting, conversion, or optional engines.

## Runtime Exports

- `buildScheme`
- `colorTokenGraphKind`
- `colorTokenLayerKind`
- `compileTokenGraph`
- `compiledColorSchemeKind`
- `createSchemeBuilder`
- `defineTokenGraph`
- `defineTokenLayer`
- `defineTokens`
- `exportCssVars`
- `parseCompiledScheme`
- `parseTokenGraph`
- `parseTokenLayer`
- `serializeCompiledScheme`
- `serializeTokenGraph`
- `serializeTokenLayer`
- `tokenRef`

## Package Subpaths

The package exports only:

- `.`
- `./schemas/color-token-graph.v1.schema.json`
- `./schemas/color-token-layer.v1.schema.json`
- `./schemas/compiled-color-scheme.v1.schema.json`
- `./package.json`

There are no core Material, Texel, conversion, framework target, or CSS color utility subpaths.

## Ordinary Flow

1. Define token graph input with `defineTokens()` or `defineTokenGraph()`.
2. Resolve the selected tokens with `compileTokenGraph()`.
3. Export CSS custom properties with `exportCssVars()` or serialize deterministic JSON with
   `serializeCompiledScheme()`.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;

export { stylesheet };
```

`compileTokenGraph()` defaults to `selection: "public"`. Public tokens may depend on internal implementation tokens.

## Color Values

Color token values are authored strings. Root preserves and emits the string it receives. It may reject malformed token
artifacts, references, unsafe CSS declarations, or duplicate CSS variable names, but it does not validate whether a color
string is meaningful CSS.

Bare strings are always color values. They are not inferred as references based on spelling. References are explicit
through:

- `aliases: { "app.primary": "brand.primary" }`;
- `tokenRef("brand.primary")`;
- `{ ref: "brand.primary" }`.

## Authoring Helpers

`defineTokens(tokens, options?)` is the smallest helper. With no options it creates a one-mode graph with `base` as the
mode.

`defineTokenGraph(input)` is the full graph-shaped helper. It accepts `tokens` for authored values and `aliases` for
token-key mappings. It does not accept ambiguous flat top-level token records.

`defineTokenLayer(input)` defines an ordered overlay layer with `tokens` and `aliases`. Layers are graph contributions;
they do not own the graph mode envelope.

Helper input fills safe defaults and returns strict graph or layer input. Helper shorthand is not the persisted wire
format.

## Strict Wire Format

`parseTokenGraph()`, `parseTokenLayer()`, and `parseCompiledScheme()` validate strict persisted artifacts. Strict
artifacts carry a `kind` discriminator and `formatVersion: 1`.

Strict graph and layer token definitions use `value` or `valueByMode`. Values are strings or explicit references.
Compiled scheme values are resolved strings.

JSON Schema subpaths validate these strict artifact shapes. Runtime parsers remain the semantic authority for
default-mode membership, per-mode coverage, reference existence, reference cycles, and cross-field constraints.

## CSS Export

`exportCssVars()` consumes compiled schemes only. It does not resolve references, load engines, or mutate browser state.
Its success value contains:

- `css`: stylesheet text;
- `blocks`: ordered `{ mode, selector, declarations }` data;
- `variableByToken`: token key to custom-property lookup.

Omitting `prefix`, passing `undefined`, or passing `""` emits unprefixed custom properties such as `--background`.
Passing `prefix: "color"` emits namespaced properties such as `--color-background`.

The exporter validates CSS custom-property names, variable uniqueness, selectors, and declaration safety. It does not
parse or rewrite color values.

## Build Scheme

`buildScheme()` is the adapter runner and layer composer. It accepts generated base inputs, authored layers, or both,
then compiles the composed graph.

`createSchemeBuilder(config)` prepares reusable build options except `base`. The returned builder accepts no base,
source shorthand, or `{ base }` for the same path as `buildScheme()`.

Base inputs compose first. Layers compose after base inputs in array order. Later layers win by token key. Layer
composition is deterministic token overlay behavior, not CSS cascade behavior.

## Material 3

Material 3 lives in `@scheme-tokens/material3`. The adapter owns Material generation, strict `#rrggbb` source-color
validation, Material-specific issue codes, and its engine dependency. The root package imports only generic source
contracts.
