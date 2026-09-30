# Define Tokens

## One authoring grammar

Use a direct string, a direct `tokenRef()`, a concat expression, a direct explicit mode map, or an expanded definition with required `value` and optional metadata.

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
      description: "Brand source",
    },
    primary: tokenRef("brand.600"),
    literal: "brand.600",
  },
});

export { graph };
```

`primary` is a reference. `literal` is the literal string `"brand.600"`. The package never infers references from spelling.

`valueByMode`, aliases, and metadata mixed directly with mode keys are not part of the grammar.

## Explicit modes

Omitted mode options mean `base`/`base`. Multimode graphs require an explicit envelope and default:

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "brand.600": "oklch(62% 0.18 250)",
    "brand.400": "oklch(78% 0.12 250)",
    background: {
      light: "#ffffff",
      dark: "#111111",
    },
    primary: {
      value: {
        light: tokenRef("brand.600"),
        dark: tokenRef("brand.400"),
      },
      description: "Primary action fill",
    },
  },
});

export { graph };
```

There is no mode discovery from token keys and no first-key default. Authored mode order is preserved, even when the default is not first.

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Layers

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

```ts
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const generated = defineTokenLayer({
  id: "generated",
  defaultVisibility: "internal",
  tokens: { "brand.600": "oklch(62% 0.18 250)" },
});

const semantic = defineTokenLayer({
  id: "semantic",
  tokens: { primary: tokenRef("brand.600") },
});

const graph = defineTokenGraph({
  tokens: {},
  layers: [generated, semantic],
});

export { graph };
```

Later layers override earlier definitions with the same key. This is deterministic token composition, not CSS cascade behavior. TypeScript tracks the same composition, so the inferred public keys of a literal graph match what compilation returns; see [TypeScript Access](./typescript-access.md).

The graph/layer helpers, `tokenRef`, and `tokenConcat` are trusted TypeScript entry points. They copy accepted data and may throw for programmer misuse. Use the parser functions for untrusted persisted input.
