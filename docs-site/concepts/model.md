# Model

The model is small once the first stylesheet is working.

## Direct Tokens

Direct tokens hold concrete color values. They are the normal first path:

```ts
import { defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  primary: "oklch(0.54 0.16 285)",
});

export { graph };
```

## Semantic Tokens

Semantic tokens are product, app, role, and context tokens. They may hold direct color values or reference implementation
tokens. An alias is the mechanism. A semantic token is the product concept.

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": "#6750a4",
  },
  semanticTokens: {
    primary: { value: tokenRef("brand.primary") },
  },
});

export { graph };
```

## Layers

Layers are ordered authored overlays. Later layers win by token key after sources have produced their base graph.

## Sources

Sources are adapter inputs for `buildScheme()`. The Material 3 adapter is a source adapter: it generates graph material
before app layers are applied.

## Compiled Scheme

A compiled scheme contains selected tokens with resolved color values, mode values, visibility, origin metadata, and
direct dependency metadata. Exporters consume compiled schemes.

## CSS Export

`exportCssVars()` converts a compiled scheme into a stylesheet string, ordered declaration blocks, and a token-key to CSS
custom-property map. It does not mutate the DOM or act as a runtime theme manager.

## Persisted Artifacts

Persisted graph, layer, and compiled-scheme artifacts carry `kind` and `formatVersion`. Colors are structured in
persisted artifacts so files stay explicit and deterministic.
