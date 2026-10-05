# Define tokens

## Define values

Token values are strings. Keys use dot-separated lower-kebab paths, such as `surface.canvas`
or `brand.600`.

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "surface.canvas": "#ffffff",
    "spacing.small": "8px",
  },
});
```

## Add references

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
    label: "brand.600",
  },
});
```

`primary` resolves to `#6750a4`. `label` stays the literal string `brand.600`.

Use `tokenConcat` when a value combines text and references:

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    primary: "#6750a4",
    ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
  },
});
```

Template substitutions must be references. See the
[expression reference](../reference/api.md#expressions) for normalization and limits.

## Add modes

Declare the modes and `defaultMode` on the graph:

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: { light: "#ffffff", dark: "#111111" },
    spacing: "8px",
  },
});
```

A mode map supplies every graph mode. A direct expression applies to all modes. The graph
preserves your mode order, and `defaultMode` can be any member of that list.

## Compose layers

Use layers to share tokens or separate generated values from application declarations:

```ts
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const brand = defineTokenLayer({
  id: "brand",
  tokens: { "brand.600": "#6750a4" },
});
const overrides = defineTokenLayer({
  id: "overrides",
  tokens: { "brand.600": "#009489" },
});

const graph = defineTokenGraph({
  layers: [brand, overrides],
  tokens: { primary: tokenRef("brand.600") },
});
```

`primary` resolves to `#009489`. Layers compose in array order, then graph-local tokens take
precedence. Each layer needs a unique ID. Layers provide values for the graph's modes; their
mode maps must share the same mode set and match the graph when composed.

## Control visibility

Keep source values internal while exposing application names:

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": { value: "#6750a4", visibility: "internal" },
    primary: tokenRef("brand.600"),
  },
});

const publicTokens = compileTokenGraph(graph);
const allTokens = compileTokenGraph(graph, { selection: "all" });
const selectedTokens = compileTokenGraph(graph, { selection: ["primary"] });
```

Default compilation returns public tokens after resolving references through the whole graph.
`selection: "all"` includes internal tokens; a key array chooses the output directly.

Set `defaultVisibility: "internal"` on a graph or layer to make newly introduced tokens internal.
An override keeps the existing visibility unless it specifies `visibility`. The
[composition reference](../reference/api.md#layers-and-visibility) covers these rules.

## Add metadata

Put an expression or mode map under `value` when adding metadata:

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      value: { light: "#ffffff", dark: "#111111" },
      description: "Page background",
    },
  },
});
```

Definitions support `visibility`, `description`, `deprecated`, and `extensions`.
Later declarations replace descriptive metadata along with the value.

Use the helpers for TypeScript authoring and [parsers](../reference/api.md#parsers) for
persisted or untrusted data.
