# scheme-tokens

`scheme-tokens` compiles string-valued token graphs. Define tokens, connect them with references,
compose layers, and resolve values for each mode. Export the result as CSS custom properties or
serialize it for other tools.

## Install

```sh
pnpm add scheme-tokens
```

The package is ESM-only and runs in browsers and Node.js 24 or newer. TypeScript support starts at
5.9.3, 6.0.2, and 7.0.2 for their respective major versions; see the
[TypeScript guide](./docs-site/guide/typescript-access.md).

## Define and compile a graph

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
  },
});

const scheme = orThrow(compileTokenGraph(graph));
const stylesheet = orThrow(exportCssVars(scheme)).css;
```

```css
:where(:root) {
  --background: #ffffff;
  --foreground: #111111;
}
```

Graphs use a single `base` mode by default. Token keys become CSS variable names by joining their
dot-separated segments with hyphens: `surface.canvas` becomes `--surface-canvas`.

`compileTokenGraph()` and `exportCssVars()` return a `Result`. `orThrow()` returns its value or
throws an error with the issues in `cause`. To handle failures yourself, check `ok` and read
`compiled.value` or `exported.value.css`; see [Diagnostics](./docs/diagnostics.md).

## Add references

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
    ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
  },
});
```

Bare strings are literal values. Use `tokenRef()` for a reference and `tokenConcat` to combine
text with references. Template substitutions must be references.

## Add modes

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

The graph defines the modes and their default. A mode map supplies a value for every mode;
a direct value such as `spacing` applies to all of them.

## Compose layers

```ts
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const brand = defineTokenLayer({
  id: "brand",
  defaultVisibility: "internal",
  tokens: { "brand.600": "#6750a4" },
});

const graph = defineTokenGraph({
  layers: [brand],
  tokens: { primary: tokenRef("brand.600") },
});
```

Layers compose in array order, followed by the graph's own tokens. Later declarations replace
earlier values. An override keeps the existing visibility unless it sets `visibility` explicitly.

Compilation selects public tokens by default, so `primary` resolves through `brand.600` while the
source stays internal. Use `selection: "all"` to include internal tokens, or a key array to choose
the output. See [Define tokens](./docs-site/guide/define-tokens.md) for composition and visibility.

## Export CSS

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { light: "#ffffff", dark: "#111111" } },
});

const scheme = orThrow(compileTokenGraph(graph));
const css = orThrow(
  exportCssVars(scheme, {
    prefix: "app",
    activation: {
      media: { dark: "(prefers-color-scheme: dark)" },
      attribute: "data-theme",
    },
  }),
).css;
```

This emits `--app-background` with light values at the root, a dark system-preference rule, and
`data-theme="light"` / `data-theme="dark"` rules for themed subtrees. Attribute activation is
opt-in. Class activation uses `activation.selectors`, for example `{ dark: ".dark" }`.

Generated selectors use `:where()` with zero specificity. For live CSS references, set
`references: "var"`; for a cascade layer, set `cascadeLayer: "tokens"`. The
[CSS guide](./docs-site/guide/export-css-variables.md) covers these options and nested themes.

## Add Material 3 colors

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" })],
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "action.primary": tokenRef("md.sys.color.primary"),
  },
});
```

`@scheme-tokens/material3` generates 48 Material 3 color roles as a layer. The default modes are
`light` and `dark`; variants, contrast, and custom modes are configurable. Material `0.2.0`
requires core `^0.4.0`. See the [Material README](./packages/material3/README.md).

## Further reading

- [Getting started](./docs-site/guide/getting-started.md)
- [API reference](./docs-site/reference/api.md), [CSS reference](./docs-site/reference/css.md),
  and [diagnostics](./docs/diagnostics.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Tailwind CSS v4](./docs/tailwind-css-v4.md)
- [TypeScript access](./docs-site/guide/typescript-access.md)
- [Architecture](./docs/architecture.md), [development](./docs/development.md), and
  [versioning](./docs/semver.md)

For persisted data, use the parsers and serializers described in the
[artifact reference](./docs-site/reference/api.md#artifacts-and-schemas). To pass compiled tokens
to a tool such as Style Dictionary or Terrazzo, map them to that tool's input format.
