# Upgrade to 0.4

Core `0.4.0` changes authoring, composition, compiled metadata, and CSS activation.
Use Material `0.2.0` alongside it; its peer range is `^0.4.0`.

## Update authoring

Replace defineTokens calls with `defineTokenGraph({ tokens })`. Declare `modes` and
`defaultMode` on the graph when supplying modes. Layers provide values for those modes.

Layers now compose before graph-local tokens. Move any intended final override into graph
tokens or order it after the other layers. Overrides preserve visibility unless they specify
a new `visibility`.

All mode maps within a layer must share one set and match the graph. Internally conflicting maps
return `inconsistent-layer-modes`; a layer/graph difference returns `layer-mode-mismatch`.

## Recompile persisted data

Graph and layer parsers read v1 source and return v2 artifacts. Save them with the serializers
when updating stored data. Compiled v1 must be rebuilt from its source graph.

Compiled metadata uses ordered `declarations` instead of a single winning origin.
Each declaration has `origin` and optional `declaredVisibility`; effective `visibility` remains
on the token metadata. Retained references and concat parts live in `expressionByMode`.
See the [artifact reference](../reference/api.md#artifacts-and-schemas).

## Update CSS options and names

Group theme activation under `activation`:

```ts
import type { ExportCssVarsOptions } from "scheme-tokens";

const options = {
  activation: {
    root: ":root",
    media: { dark: "(prefers-color-scheme: dark)" },
    attribute: "data-theme",
    selectors: { dark: ".dark" },
  },
} satisfies ExportCssVarsOptions<string, "light" | "dark">;
```

Replace scope and selector strategies with these settings. Attribute markers are opt-in;
omit `activation.attribute` when selectors or media handle activation. To match a Shadow DOM
host, use `attribute: { name: "data-theme", includeHost: true }`.

Default variable names now use single hyphens: `action.primary` becomes `--action-primary`.
Update CSS consumers of the former double-hyphen names and resolve any reported naming collisions.

Structured blocks expose `tier`, `mode`, `selectors`, optional `media`, and `declarations`.
Check exhaustive diagnostic switches against the [issue reference](../reference/diagnostics.md)
and activation behavior against the [CSS reference](../reference/css.md).

## Update Material generation

Compose the returned layer directly, replacing fragment spreading. Replace additive modes or
exactModes with `modeSettings`, rename appearance to `colorMode`, and declare `defaultMode`
on the graph:

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4")],
});
```

Custom mode names require `colorMode`. Narrow or default possibly undefined options before
forwarding them. See the [Material reference](../reference/material3.md).

## Check type annotations

`TokenGraph`'s third generic is the public key union. `TokenLayer` carries its mode set and
`LayerVisibilityFacts`. Prefer helper inference over manual annotations.

Literal public selections can now be complete. Parsed or dynamic key sets, uncertain visibility,
and runtime selection arrays remain partial. The [TypeScript guide](./typescript-access.md)
explains definite access.

For the earlier pre-publication API reset, see the
[historical 0.1 migration](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs/migration.md).
