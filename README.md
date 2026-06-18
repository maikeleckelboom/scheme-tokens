# color-scheme-tokens

Stable color scheme tokens for TypeScript apps.

color-scheme-tokens is a graph-first package for stable, typed, inspectable color tokens. Dynamic color is the first
intended scheme source, but it is not the package identity: scheme sources produce token graphs, profiles can add app
aliases, and implemented exporters project compiled token sets.

The intended pipeline is:

```text
scheme source input
  -> scheme source graph
  -> profile graph
  -> compiled token set
  -> CSS variables or deterministic snapshot serialization
```

This repository is private at version `0.0.0` while the public contract is being formed. It does not publish the old
wrapper-shaped API.

## Minimal Core

```ts
import {
  compileGraph,
  createSchemeGraph,
  darkMode,
  exportCssVariables,
  hex,
  lightMode,
  serializeTokenSet,
  tokenKey,
} from "color-scheme-tokens";

const graph = createSchemeGraph({
  modes: [lightMode, darkMode],
  tokens: [
    {
      kind: "color",
      key: tokenKey("scheme.primary"),
      value: [
        { mode: lightMode, value: hex("#6750a4") },
        { mode: darkMode, value: hex("#d0bcff") },
      ],
    },
    {
      kind: "alias",
      key: tokenKey("app.action"),
      target: tokenKey("scheme.primary"),
    },
  ],
});

const compiled = compileGraph(graph);

if (compiled.ok) {
  const css = exportCssVariables(compiled.value);
  const snapshot = serializeTokenSet(compiled.value);
}
```

## Current Scope

- Public token keys use `scheme.*` for scheme roles.
- Color token nodes store concrete `ColorValue` objects directly.
- `validateGraph`, `compileGraph`, `serializeTokenSet`, and `exportCssVariables` are implemented.
- A dedicated JSON token exporter is deferred; `serializeTokenSet()` is the deterministic JSON snapshot primitive.
- Color intent, lab proof tooling, CLI integrations, framework bindings, contrast repair, and editor tooling are out of
  scope for this package shape.

## Development

```bash
pnpm install
pnpm validate
pnpm release:check
```

Tooling is Oxc-first: Oxlint is the lint gate and Oxfmt is the formatter.

`pnpm release:check` currently runs type checking, linting, tests, build, formatting, and a dry-run package pack. The
package is marked `private: true`; do not publish it from this repository state.
