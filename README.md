# color-scheme-tokens

Stable color scheme tokens for TypeScript apps.

color-scheme-tokens is a graph-first package for stable, typed, inspectable color tokens. Dynamic color is the first
scheme source, but it is not the package identity: scheme sources produce token graphs, profiles add app aliases, and
exporters project compiled token sets.

The intended pipeline is:

```text
scheme source input
  -> scheme source graph
  -> optional profile graph
  -> compiled token set
  -> CSS variables or deterministic snapshot serialization
```

This repository is private at version `0.0.0` while the public contract is being formed. It does not publish the old
wrapper-shaped API. The package is ESM-only.

## Minimal Core

```ts
import {
  type ColorSchemeTokenGraph,
  compileGraph,
  darkMode,
  exportCssVariables,
  hex,
  lightMode,
  serializeTokenSet,
  solidColorIntent,
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
        { mode: lightMode, value: solidColorIntent(hex("#6750a4")) },
        { mode: darkMode, value: solidColorIntent(hex("#d0bcff")) },
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

if (compiled.ok) {
  const css = exportCssVariables(compiled.value);
  const snapshot = serializeTokenSet(compiled.value);
}
```

## Dynamic Source Graph

```ts
import { createSchemeGraph, dynamicSchemeSource, hex } from "color-scheme-tokens";

const graphResult = createSchemeGraph({
  source: dynamicSchemeSource({
    sourceColor: hex("#6750A4"),
  }),
});

if (graphResult.ok) {
  graphResult.value.tokens.length;
}
```

## Dynamic Source Recipe

```ts
import { createSchemeTokens, dynamicSchemeSource, hex } from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({
    sourceColor: hex("#6750A4"),
  }),
  css: { prefix: "theme" },
});

if (result.ok) {
  result.value.cssVariables.includes("--theme-scheme-primary:");
}
```

The dynamic source accepts opaque sRGB source colors in this tranche. `hex("#6750A4")` and `srgb255(103, 80, 164)` are
valid inputs. The public variants are `tonal`, `vibrant`, `expressive`, and `neutral`. Defaults are spec version
`2021`, platform `phone`, contrast level `0`, and variant `tonal`.

The dynamic source is backed internally by `@material/material-color-utilities`, but public token keys use `scheme.*`
and the package API does not expose Material-branded wrapper types.

Dynamic color algorithm changes are package-level events because upstream generation changes can alter compiled token
output. The upstream package is pinned exactly, and deterministic snapshot fixtures are expected to catch output drift.

## Optional App Alias Profile

```ts
import {
  appSurfaceProfile,
  createSchemeTokens,
  dynamicSchemeSource,
  hex,
} from "color-scheme-tokens";

const result = createSchemeTokens({
  source: dynamicSchemeSource({
    sourceColor: hex("#6750A4"),
  }),
  profile: appSurfaceProfile,
  css: { prefix: "theme" },
});

if (result.ok) {
  result.value.cssVariables.includes("--theme-chrome-background:");
}
```

Profiles are optional graph extensions. They do not affect source color generation. They add app-level aliases or
additional token nodes on top of the scheme source graph. `appSurfaceProfile` adds app-facing aliases such as
`chrome.*` and `semantic.*` tokens on top of the base `scheme.*` tokens.

## Current Scope

- Public token keys use `scheme.*` for scheme roles.
- Color token nodes store mode-specific `ColorIntent` payloads; v0 supports only `solidColorIntent(value)`.
- `validateGraph`, `compileGraph`, `serializeTokenSet`, `exportCssVariables`, `dynamicSchemeSource`,
  `applyProfile`, `appSurfaceProfile`, and `createSchemeTokens` are implemented.
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
