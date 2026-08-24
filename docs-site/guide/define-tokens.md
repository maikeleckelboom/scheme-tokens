# Define Tokens

## One authoring grammar

Use a direct string, a direct `tokenRef()`, a direct explicit mode map, or an expanded definition with required `value` and optional metadata.

```ts twoslash
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.600": {
    value: "oklch(62% 0.18 250)",
    visibility: "internal",
    description: "Brand source",
  },
  primary: tokenRef("brand.600"),
  literal: "brand.600",
});

export { graph };
```

`primary` is a reference. `literal` is the literal string `"brand.600"`. The package never infers references from spelling.

`valueByMode`, aliases, and metadata mixed directly with mode keys are not part of the grammar.

## Explicit modes

Omitted mode options mean `base`/`base`. Multimode graphs require an explicit envelope and default:

```ts twoslash
import { defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens(
  {
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
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

export { graph };
```

There is no mode discovery from token keys and no first-key default.

Mode names reserve `ref`, `value`, `valueByMode`, `visibility`, `description`, `deprecated`, and `extensions` so object authoring is unambiguous. Token-key segments after the first may be numeric, making keys such as `brand.600` valid.

## Layers

Layers have identities and local default visibility, but never modes. An isolated layer therefore
retains `TokenLayer<Key, string>` rather than claiming an inferred mode union. Direct expressions
apply to every mode in the owning graph. Explicit mode maps stay unbound until graph composition,
where they must cover the graph's modes exactly. The graph then applies layers in array order.

```ts twoslash
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

Later layers override earlier definitions with the same key. This is deterministic token composition, not CSS cascade behavior.

The four `define*`/`tokenRef` helpers are trusted TypeScript entry points. They copy accepted data and may throw for programmer misuse. Use the parser functions for untrusted persisted input.
