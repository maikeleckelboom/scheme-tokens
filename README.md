# scheme-tokens

`scheme-tokens` compiles token graphs.

Define string values, explicit references, modes and ordered layers. `compileTokenGraph()` resolves
them into a deterministic scheme with provenance and direct dependencies per mode.
Core does not know what a color is. Values are opaque strings.

Generators such as [`@scheme-tokens/material3`](./packages/material3/README.md) plug in as normal
token layers.

## Install

Core:

```sh
pnpm add scheme-tokens
```

With Material 3 color generation:

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

Both packages are ESM-only. Node.js usage requires Node 24 or newer. Core has no runtime
dependencies or filesystem access and runs in browsers.

## First graph

References are explicit. Bare strings are always literal values.

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  "brand.600": {
    value: "oklch(62% 0.18 250)",
    visibility: "internal",
  },

  "action.primary": tokenRef("brand.600"),
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value);

if (!exported.ok) {
  throw new Error(exported.issues.map((issue) => issue.message).join("\n"));
}

console.log(exported.value.css);
```

Output:

```css
:root {
  --action--primary: oklch(62% 0.18 250);
}
```

References can resolve through `brand.600`, but it stays out of the default public output. Dotted
token segments stay distinct in CSS names, so `action.primary` becomes `--action--primary`.

## Material 3

The sibling package's `material3` helper returns `modes`, `defaultMode`, and one normal `TokenLayer`
in `layers`.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
```

The default layer contains 48 `md.sys.color.*` roles with complete `light` and `dark` values,
including:

```text
md.sys.color.primary
md.sys.color.on-primary
md.sys.color.primary-container
md.sys.color.on-primary-container

md.sys.color.surface
md.sys.color.on-surface
md.sys.color.surface-container
md.sys.color.outline
```

The role names form a literal TypeScript union.

The adapter owns Material color generation, variants, contrast levels, and source colors. Core
owns graph composition, references, modes, visibility, layer order, compilation, provenance,
serialization, and CSS projection.

### Expose application semantics

Material roles can stay internal while the application exposes its own token names.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const graph = defineTokenGraph({
  ...material,

  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "surface.foreground": tokenRef("md.sys.color.on-surface"),

    "action.primary.background": tokenRef("md.sys.color.primary"),
    "action.primary.foreground": tokenRef("md.sys.color.on-primary"),
  },
});

const compiled = compileTokenGraph(graph);
```

Default compilation resolves the internal Material roles and returns the public application
tokens.

### Variants, contrast, and custom modes

Use `modes` to patch the built-in `light` and `dark` modes or add custom ones.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  specVersion: "2025",
  variant: "expressive",
  contrastLevel: 0.5,

  modes: {
    "light-high": {
      appearance: "light",
      contrastLevel: 1,
    },

    "brand-dark": {
      appearance: "dark",
      sourceColor: "#009489",
    },
  },

  defaultMode: "light-high",
});
```

Use `exactModes` to replace the built-in `light` and `dark` set.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  exactModes: {
    standard: {
      appearance: "light",
    },

    inverse: {
      appearance: "dark",
      contrastLevel: 0.5,
    },
  },

  defaultMode: "standard",
});
```

TypeScript keeps custom mode names as a literal union in `Material3GraphFragment`, the composed
graph, and the compiled scheme.

## Material 3 with shadcn/ui

You can map [shadcn/ui](https://ui.shadcn.com/docs/theming) roles to internal Material roles with
`tokenRef()`.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, exportCssVars, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const theme = defineTokenGraph({
  ...material,

  tokens: {
    background: tokenRef("md.sys.color.background"),
    foreground: tokenRef("md.sys.color.on-background"),

    card: tokenRef("md.sys.color.surface-container-low"),
    "card-foreground": tokenRef("md.sys.color.on-surface"),

    popover: tokenRef("md.sys.color.surface-container"),
    "popover-foreground": tokenRef("md.sys.color.on-surface"),

    primary: tokenRef("md.sys.color.primary"),
    "primary-foreground": tokenRef("md.sys.color.on-primary"),

    secondary: tokenRef("md.sys.color.secondary-container"),
    "secondary-foreground": tokenRef("md.sys.color.on-secondary-container"),

    muted: tokenRef("md.sys.color.surface-container-low"),
    "muted-foreground": tokenRef("md.sys.color.on-surface-variant"),

    accent: tokenRef("md.sys.color.surface-container-high"),
    "accent-foreground": tokenRef("md.sys.color.on-surface"),

    destructive: tokenRef("md.sys.color.error"),
    "destructive-foreground": tokenRef("md.sys.color.on-error"),

    border: tokenRef("md.sys.color.outline-variant"),
    input: tokenRef("md.sys.color.outline"),
    ring: tokenRef("md.sys.color.primary"),
  },
});

const compiled = compileTokenGraph(theme);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value, {
  modeSelectors: {
    strategy: "selectors",
    selectors: {
      light: ":root",
      dark: ".dark",
    },
  },
});

if (!exported.ok) {
  throw new Error(exported.issues.map((issue) => issue.message).join("\n"));
}

console.log(exported.value.css);
```

This is an application mapping, not a built-in shadcn adapter. Material and shadcn/ui do not define
identical semantics.

Chart roles are left out. Material does not define a five-series categorical chart palette.
Sidebar roles are application-specific too, so this example leaves them out.

## Layers and overrides

Generated and authored layers use the same ordering rules.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const overrides = defineTokenLayer({
  id: "brand-overrides",
  defaultVisibility: "internal",

  tokens: {
    "md.sys.color.primary": "#ff0055",
  },
});

const graph = defineTokenGraph({
  ...material,

  layers: [...material.layers, overrides],

  tokens: {
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
```

Later layers win. Compiled provenance identifies the winning layer, and
`dependenciesByMode` records direct reference edges.

## Modes

Modes belong to the graph. Layers only provide values for those modes.

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
      light: tokenRef("brand.600"),
      dark: tokenRef("brand.400"),
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);
```

## Visibility and selection

References resolve before visibility is applied.

```ts twoslash
import { compileTokenGraph, defineTokens, tokenRef } from "scheme-tokens";

const graph = defineTokens({
  source: {
    value: "#6750a4",
    visibility: "internal",
  },

  primary: tokenRef("source"),
});

const publicScheme = compileTokenGraph(graph);
const completeScheme = compileTokenGraph(graph, {
  selection: "all",
});
const exactScheme = compileTokenGraph(graph, {
  selection: {
    keys: ["primary"],
  },
});
```

Default compilation selects public tokens. `selection: "all"` includes internal tokens. A literal
`keys` selection stays exact in TypeScript.

## Persisted artifacts

Graphs, layers, and compiled schemes have strict versioned artifact forms. Use the `define*`
helpers for trusted TypeScript authoring. Use `parseTokenGraph()`, `parseTokenLayer()`, and
`parseCompiledScheme()` for persisted or otherwise untrusted input. Their matching serializers
produce canonical output. Published schemas are available at:

```text
scheme-tokens/schemas/token-graph.v1.schema.json
scheme-tokens/schemas/token-layer.v1.schema.json
scheme-tokens/schemas/compiled-scheme.v1.schema.json
```

## CSS projection

CSS export is separate from compilation. `exportCssVars()` takes a compiled scheme and emits CSS
plus structured block data.

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens(
    {
      primary: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
    {
      modes: ["light", "dark"],
      defaultMode: "light",
    },
  ),
);

if (!compiled.ok) {
  throw new Error(compiled.issues.map((issue) => issue.message).join("\n"));
}

const exported = exportCssVars(compiled.value, {
  prefix: "app",

  modeSelectors: {
    strategy: "selectors",

    selectors: {
      light: ":root",
      dark: ".dark",
    },
  },
});
```

The result contains emitted CSS, structured blocks, and the token-to-variable lookup:

```text
exported.value.css
exported.value.blocks
exported.value.variableByToken
```

Selectors and output policy belong to the CSS export call, not the token graph.

## Results

Fallible public operations return the same `Result`: `{ ok: true, value }` or
`{ ok: false, issues }`. The `issues` tuple is never empty.

Trusted authoring helpers may throw on programmer misuse. Parsers accept `unknown` and return
structured issues for invalid persisted data.

## DTCG and downstream tooling

`scheme-tokens` composes and resolves a graph before platform tools run. It does not implement the
DTCG `$type` and `$value` authoring model or interpret token value domains.

To use Style Dictionary or Terrazzo downstream, convert the compiled output to the input format
each tool expects. `scheme-tokens` does not ship those adapters. Applications can also use the
built-in CSS projection directly.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Executable theme-coordinate example](./examples/theme-coordinates/README.md)
- [Tailwind CSS v4](./docs/tailwind-css-v4.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Semver](./docs/semver.md)
- [Material 3 adapter](./packages/material3/README.md)
