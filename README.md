# color-scheme-tokens

Stable graph-first color tokens for TypeScript apps.

color-scheme-tokens builds typed, inspectable token graphs, compiles aliases and modes into deterministic token sets,
and exports those compiled tokens to CSS variables or stable JSON snapshots. Source adapters can generate a graph, but
they do not define the graph model.

This repository is private at version `0.0.0` while the public contract is being formed. The package is ESM-only.

## Recipe

```ts
import { createSchemeTokens, dynamicSchemeSource, hex } from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  css: { prefix: "theme" },
});

if (!result.ok) throw new Error(JSON.stringify(result.problems));

result.value.cssVariables;
```

The recipe runs the source adapter, compiles the token graph, serializes a deterministic snapshot, and exports CSS
variables. Consumers do not need layers or the transform hook for the basic path.

## Add Aliases

```ts
import { createSchemeTokens, dynamicSchemeSource, hex } from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  aliases: {
    "app.action": "scheme.primary",
    "app.canvas": "scheme.surface",
  },
  css: { prefix: "theme" },
});

if (!result.ok) throw new Error(JSON.stringify(result.problems));

result.value.cssVariables;
```

`aliases` is recipe sugar for alias token nodes. Alias keys and targets are validated through the normal graph compile
path, so duplicate keys, invalid token keys, and unresolved targets use the same validation behavior as manual graphs.

## Add A Layer

```ts
import { appSurfaceLayer, createSchemeTokens, dynamicSchemeSource, hex } from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  layers: [appSurfaceLayer],
  css: { prefix: "theme" },
});

if (!result.ok) throw new Error(JSON.stringify(result.problems));

result.value.cssVariables;
```

Token layers are optional reusable graph additions. They usually add aliases or authored token nodes that should be
shared across recipes. `appSurfaceLayer` is a small convenience layer for `chrome.*` and `semantic.*` aliases, not a
required app model.

## Add A Transform

```ts
import { createSchemeTokens, dynamicSchemeSource, hex, tokenKey } from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
  aliases: {
    "app.action": "scheme.primary",
  },
  transform: (graph) => ({
    ...graph,
    tokens: [
      ...graph.tokens,
      {
        kind: "alias",
        key: tokenKey("brand.action"),
        target: tokenKey("app.action"),
      },
    ],
  }),
  css: { prefix: "theme" },
});
```

`transform` receives the graph after layers and aliases, returns a graph, and then the normal validation, compile,
serialization, and CSS export pipeline continues.

The recipe pipeline is:

```text
source
  -> layers
  -> aliases
  -> transform
  -> validated/compiled token set
  -> CSS variables and deterministic snapshot serialization
```

## Manual Graph

```ts
import {
  type ColorSchemeTokenGraph,
  compileGraph,
  darkMode,
  hex,
  lightMode,
  literalColor,
  tokenKey,
} from "color-scheme-tokens";

const graph: ColorSchemeTokenGraph = {
  schemaVersion: "color-scheme-token-graph/v0",
  modes: [lightMode, darkMode],
  tokens: [
    {
      kind: "color",
      key: tokenKey("scheme.primary"),
      values: [
        { mode: lightMode, value: literalColor(hex("#6750a4")) },
        { mode: darkMode, value: literalColor(hex("#d0bcff")) },
      ],
    },
    {
      kind: "alias",
      key: tokenKey("app.action"),
      target: tokenKey("scheme.primary"),
    },
  ],
};

const compiled = compileGraph(graph);

if (!compiled.ok) throw new Error(JSON.stringify(compiled.problems));

compiled.value;
```

The manual API is useful when an application already owns its token graph or when tests need exact graph fixtures.

## Inspect A Source Graph

```ts
import { createSchemeGraph, dynamicSchemeSource, hex } from "color-scheme-tokens";

const graphResult = createSchemeGraph({
  source: dynamicSchemeSource({ sourceColor: hex("#6750A4") }),
});

if (!graphResult.ok) throw new Error(JSON.stringify(graphResult.problems));

graphResult.value.tokens;
```

The dynamic source accepts opaque sRGB source colors in this tranche. `hex("#6750A4")` and `srgb255(103, 80, 164)` are
valid inputs. The public variants are `tonal`, `vibrant`, `expressive`, and `neutral`. Defaults are spec version
`2021`, platform `phone`, contrast level `0`, and variant `tonal`.

Dynamic color is currently backed by `@material/material-color-utilities`, but that backing package is a source
implementation detail. The token graph, compiler, layers, transform hook, serialization, and CSS export are not
Material-specific.

The dynamic source emits `scheme.*` tokens. That namespace is source-emitted token data, not mandatory graph structure.
Dynamic color algorithm changes are package-level events because upstream generation changes can alter compiled token
output. The upstream package is pinned exactly, and deterministic snapshot fixtures are expected to catch output drift.

## Current Scope

- Token graph primitives, token keys, modes, color token values, aliases, validation, compilation, deterministic
  serialization, and CSS export are implemented.
- `dynamicSchemeSource()` is the first source adapter.
- `createSchemeTokens()` provides the simple recipe path with optional aliases, reusable layers, and one advanced
  transform hook.
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
