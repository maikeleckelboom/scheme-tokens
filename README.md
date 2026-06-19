# color-scheme-tokens

Stable graph-first color tokens for TypeScript apps.

color-scheme-tokens builds typed, inspectable token graphs, compiles aliases and modes into deterministic token sets,
and exports those compiled tokens to CSS variables or stable JSON snapshots. Source adapters can generate a graph, but
they do not define the graph model.

Material 3 Dynamic Color is provided through the Material 3 source adapter. The token graph, recipe pipeline, compiler,
layers, deterministic serialization, and CSS export are not Material-specific.

This repository is private at version `0.0.0` while the public contract is being formed. The package is ESM-only.

## Minimal Recipe

```ts
import { createSchemeTokens } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const result = createSchemeTokens({
  source: material3Source({
    color: "#6750A4",
  }),
  css: { prefix: "theme" },
});

if (!result.ok) {
  throw new Error(JSON.stringify(result.problems));
}

result.value.cssVariables;
```

The recipe runs the source adapter, validates and compiles the token graph, serializes a deterministic snapshot, and
exports CSS variables. The root package owns the generic graph and recipe APIs. The Material 3 adapter is imported from
`color-scheme-tokens/sources/material3`.

## Simple Aliases

```ts
import { createSchemeTokens } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const result = createSchemeTokens({
  source: material3Source({
    color: "#6750A4",
  }),
  aliases: {
    "app.action": "m3.primary",
    "app.actionText": "m3.onPrimary",
    "app.canvas": "m3.surface",
    "app.text": "m3.onSurface",
  },
  css: { prefix: "theme" },
});
```

`aliases` is recipe sugar for alias token nodes. `m3.*` tokens are emitted by the Material 3 source adapter; `app.*`
tokens are application-owned names. Alias keys and targets are validated through the normal graph compile path.

## Material 3 Key Colors

```ts
import { createSchemeTokens } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const result = createSchemeTokens({
  source: material3Source({
    color: "#6750A4",
    keyColors: {
      primary: "#6750A4",
      secondary: "#625B71",
      tertiary: "#7D5260",
      neutral: "#605D62",
      neutralVariant: "#605D66",
    },
  }),
  css: { prefix: "theme" },
});
```

`color` is the Material source input. `keyColors` are optional Material 3 palette key colors and are not generic graph
concepts. All color inputs are parsed and normalized during validation.

## Advanced Material 3 Algorithm

```ts
import { createSchemeTokens } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const result = createSchemeTokens({
  source: material3Source({
    color: "#6750A4",
    keyColors: {
      primary: "#6750A4",
    },
    algorithm: {
      variant: "tonalSpot",
      contrastLevel: 0,
      specVersion: "2021",
      platform: "phone",
    },
  }),
});
```

`algorithm` contains Material Dynamic Color knobs. These options belong to the Material 3 adapter, they are not recipe
options and they are not part of the graph model.

## Layers

```ts
import { createSchemeTokens, type ColorSchemeTokenLayerInput } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const applicationLayer: ColorSchemeTokenLayerInput = {
  name: "application",
  tokens: [
    { kind: "alias", key: "app.canvas", target: "m3.surface" },
    { kind: "alias", key: "app.text", target: "m3.onSurface" },
  ],
};

const result = createSchemeTokens({
  source: material3Source({
    color: "#6750A4",
  }),
  layers: [applicationLayer],
  css: { prefix: "theme" },
});
```

Token layers are reusable graph additions. They are applied after the source graph and before recipe aliases. The normal
validation, compile, serialization, and CSS export pipeline then continues.

The recipe pipeline is:

```text
source
  -> layers
  -> aliases
  -> validated/compiled token set
  -> CSS variables and deterministic snapshot serialization
```

## Manual Graph

```ts
import { type ColorSchemeTokenGraphInput, compileGraph } from "color-scheme-tokens";

const graph: ColorSchemeTokenGraphInput = {
  schemaVersion: "color-scheme-token-graph/v0",
  modes: ["light", "dark"],
  tokens: [
    {
      kind: "color",
      key: "brand.primary",
      values: [
        { mode: "light", value: "#6750a4" },
        { mode: "dark", value: "#d0bcff" },
      ],
    },
    {
      kind: "alias",
      key: "app.action",
      target: "brand.primary",
    },
  ],
};

const compiled = compileGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.problems));
}

compiled.value;
```

The manual API is useful when an application already owns its token graph or when tests need exact graph fixtures.
Manual graphs can use any valid token namespace, such as `brand.*` or `app.*`. Authored graph and layer data uses
plain strings; validation parses those strings and returns branded keys and modes only after the data is checked.

## Source Graph Inspection

```ts
import { createSourceGraph } from "color-scheme-tokens";
import { material3Source } from "color-scheme-tokens/sources/material3";

const graphResult = createSourceGraph({
  source: material3Source({
    color: "#6750A4",
  }),
});

if (!graphResult.ok) {
  throw new Error(JSON.stringify(graphResult.problems));
}

graphResult.value.tokens.find((token) => token.key === "m3.primary");
```

The Material 3 source adapter accepts opaque sRGB source colors in this tranche. Hex strings are the normal authoring
input. Low-level helpers such as `hex("#6750A4")`, `srgb255(103, 80, 164)`, and `literalColor(...)` remain available
for advanced programmatic code, but validation and source adapters do not require them in authored config. The adapter
converts parsed color values to Material ARGB values internally.

The Material 3 source adapter emits `m3.*` tokens such as `m3.primary`, `m3.onPrimary`, `m3.surface`, `m3.onSurface`,
and `m3.error`. That namespace is adapter-emitted token data, not mandatory graph structure. Dynamic color algorithm
changes are package-level events because upstream generation changes can alter compiled token output. The upstream
package is pinned exactly, and deterministic snapshot fixtures are expected to catch output drift.

## Current Scope

- Token graph primitives, token keys, modes, color token values, aliases, validation, compilation, deterministic
  serialization, and CSS export are implemented.
- `material3Source()` is the Material 3 source adapter and is exported only from
  `color-scheme-tokens/sources/material3`.
- `createSchemeTokens()` provides the recipe path with optional aliases and reusable layers.
- A dedicated JSON token exporter is deferred; `serializeTokenSet()` is the deterministic JSON snapshot primitive.
- Lab proof tooling, CLI integrations, framework bindings, DTCG export, broad source color support, image extraction,
  automatic contrast repair, and editor tooling are out of scope for this package shape.

## Development

```bash
pnpm install
pnpm validate
pnpm release:check
```

Tooling is Oxc-first: Oxlint is the lint gate and Oxfmt is the formatter.

`pnpm release:check` currently runs type checking, linting, tests, build, formatting, a dry-run package pack, and a
packed consumer smoke test for ESM, strict TypeScript declarations, and packed-output package boundaries. The package is
marked `private: true`; do not publish it from this repository state.
