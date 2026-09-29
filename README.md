# scheme-tokens

`scheme-tokens` compiles token graphs.

Define string values, explicit references, modes and ordered layers. `compileTokenGraph()` resolves
them into a deterministic scheme with declaration provenance and retained expressions per mode.
Core does not know what a color is. Values are opaque strings.

Generators such as [`@scheme-tokens/material3`](./packages/material3/README.md) plug in as normal
token layers.

This branch implements the P2 core v2 candidate for the planned 0.4 release. The manifests still carry released versions until the later versioning phase. Advanced static inference, the CSS redesign, and the next Material API remain deferred.

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

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": {
      value: "oklch(62% 0.18 250)",
      visibility: "internal",
    },

    "action.primary": tokenRef("brand.600"),
  },
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

```ts
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

```ts
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

```ts
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

```ts
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

```ts
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

```ts
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

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `visibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

## Modes

Modes belong to the graph. Layers only provide values for those modes. A direct layer expression
applies to every graph mode. A layer mode map stays unbound while standalone and must exactly cover
the owning graph's modes when composed; it never contributes or infers a graph mode envelope.

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
      light: tokenRef("brand.600"),
      dark: tokenRef("brand.400"),
    },
  },
});
```

Authored graph mode order is preserved exactly, and the default need not be first.

## Concat

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: { primary: "#6750a4", ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}` },
});
```

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Visibility and selection

References resolve before visibility is applied.

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    source: {
      value: "#6750a4",
      visibility: "internal",
    },

    primary: tokenRef("source"),
  },
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
scheme-tokens/schemas/token-graph.v2.schema.json
scheme-tokens/schemas/token-layer.v2.schema.json
scheme-tokens/schemas/compiled-scheme.v2.schema.json
```

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `layer-mode-mismatch`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.

## CSS projection

CSS export is separate from compilation. `exportCssVars()` takes a compiled scheme and emits CSS
plus structured block data.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokenGraph({
    modes: ["light", "dark"],
    defaultMode: "light",
    tokens: {
      primary: {
        light: "#6750a4",
        dark: "#d0bcff",
      },
    },
  }),
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

Selectors and output policy belong to the CSS export call, not the token graph. Exact selector maps
already contain the complete selector for every mode, so omit `scope` with
`modeSelectors.strategy: "selectors"`. A separate scope is only meaningful for generated
data-attribute or class selectors.

## Results

Fallible public operations return the same `Result`: `{ ok: true, value }` or
`{ ok: false, issues }`. The `issues` tuple is never empty.

`orThrow(result)` returns the exact success value or throws an `Error` containing every issue code, optional path, and message, with the original issue tuple in `cause`. Trusted authoring helpers use the same error convention for programmer misuse. Parsers accept `unknown` and return
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
