# Public API

The root package is the core token compiler.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: {
    base: "#ffffff",
    dark: "#111111",
  },
  foreground: {
    base: "#111111",
    dark: "#ffffff",
  },
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const stylesheet = exportCssVars(compiled.scheme);
```

## Runtime Exports

- `defineTokens(tokens, options?)`
- `defineTokenGraph(input)`
- `defineTokenLayer(input)`
- `tokenRef(key)`
- `parseTokenGraph(input)`
- `parseTokenLayer(input)`
- `compileTokenGraph(graph, options?)`
- `parseCompiledScheme(input)`
- `serializeTokenGraph(graph)`
- `serializeTokenLayer(layer)`
- `serializeCompiledScheme(scheme)`
- `exportCssVars(scheme, options?)`

## Result Payloads

Public success payloads use named fields.

```ts
const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  compiled.scheme.tokens.background.base;
}

const cssExport = compiled.ok ? exportCssVars(compiled.scheme) : undefined;

if (cssExport?.ok) {
  cssExport.css;
  cssExport.blocks;
  cssExport.variableByToken;
}
```

Parser success fields are also named:

- `parseTokenGraph(...)` returns `{ ok: true, graph }`.
- `parseTokenLayer(...)` returns `{ ok: true, layer }`.
- `parseCompiledScheme(...)` returns `{ ok: true, scheme }`.

Failures return `{ ok: false, issues }` with deterministic, JSON-safe issue objects.

## Compiled Scheme

`CompiledScheme.tokens` is a record of token keys to mode maps.

```ts
compiled.scheme.tokens.background.base;
compiled.scheme.tokens.background.dark;
```

Advanced data is stored separately:

```ts
compiled.scheme.metadataByToken.background.visibility;
compiled.scheme.metadataByToken.background.origin;
compiled.scheme.metadataByToken.background.dependenciesByMode.dark;
```

## Authored Data

Authoring helpers accept CSS-ready strings and explicit references.

```ts
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.primary": "#6750a4",
  primary: tokenRef("brand.primary"),
  literal: "brand.primary",
});
```

Bare strings are literal values. References use `tokenRef("token.key")` or strict `{ ref: "token.key" }` objects.

## Strict Wire Format

Strict graph and layer artifacts use explicit `kind`, `formatVersion`, `modes`, `defaultMode`, `defaultVisibility`, and token definitions.

Schemas are exported at:

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`
