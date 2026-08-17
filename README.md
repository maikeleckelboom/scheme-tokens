# scheme-tokens

A compiler for design-token systems.

`scheme-tokens` composes authored tokens, generated token layers, references, modes,
overrides, and visibility into one deterministic resolved scheme.

Core does not know what a color is. Values are opaque strings. Color generation and
product-specific policy live outside the compiler and can compose through ordinary token
layers.

```text
generator / authored tokens
          ↓
       layers
          ↓
   semantic tokens
          ↓
  compileTokenGraph()
          ↓
   CompiledScheme
     ├─ tokens
     ├─ modes
     └─ metadataByToken
          ├─ origin
          └─ dependenciesByMode
          ↓
    exportCssVars()
```

## Install

Core:

```sh
pnpm add scheme-tokens
```

With the Material 3 adapter:

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

Both packages are ESM-only and require Node.js 24 or newer when used in Node.js.

The core runtime has zero dependencies, no filesystem access, and is browser-safe.

## Start with semantic tokens

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

`brand.600` is internal, so it can participate in resolution without becoming part of the
public output.

That separation is useful when generated palettes or implementation tokens should feed a
smaller application-owned semantic contract.

## Material 3

[`@scheme-tokens/material3`](./packages/material3/README.md) turns a Material source color
into an ordinary `scheme-tokens` layer.

```ts twoslash
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
```

The default fragment contains complete `light` and `dark` values for 48 finite
`md.sys.color.*` roles:

```text
md.sys.color.primary
md.sys.color.on-primary
md.sys.color.primary-container
md.sys.color.on-primary-container

md.sys.color.surface
md.sys.color.on-surface
md.sys.color.surface-container
md.sys.color.outline

...
```

The result is not a separate Material theme runtime. It is normal token data that composes
through the same graph, layer, compilation, serialization, and provenance APIs as everything
else.

### Generate Material, expose your own semantics

Material roles can stay internal while your application exposes its own stable vocabulary:

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

The compiler resolves through the internal Material layer, but default public compilation
exposes only the application semantics.

```text
#6750a4
   ↓
Material 3 generation
   ↓
md.sys.color.*              internal
   ↓
application references
   ↓
surface.canvas
action.primary.background   public
```

This keeps the generator replaceable without forcing Material naming throughout the
application.

### Variants, contrast, and custom modes

Material generation coordinates remain part of the adapter rather than core:

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

Or replace the built-in `light` and `dark` set completely:

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

The resulting mode names remain finite TypeScript unions all the way into the graph and
compiled scheme.

## Material 3 → shadcn/ui

A generated system can also feed another semantic contract.

For example, [shadcn/ui](https://ui.shadcn.com/docs/theming) components consume paired roles
such as `background`, `primary`, `muted`, and `accent`, alongside roles such as `border`,
`input`, and `ring`.

Those are application semantics, not another color-generation algorithm, so they can be
expressed as references to the internal Material layer:

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

This produces the mapped semantic CSS variables:

```css
:root {
  --background: ...;
  --foreground: ...;

  --card: ...;
  --card-foreground: ...;

  --primary: ...;
  --primary-foreground: ...;

  --secondary: ...;
  --secondary-foreground: ...;

  --muted: ...;
  --muted-foreground: ...;

  --accent: ...;
  --accent-foreground: ...;

  --destructive: ...;
  --destructive-foreground: ...;

  --border: ...;
  --input: ...;
  --ring: ...;
}

.dark {
  /* Material dark-mode values for the same semantic roles. */
}
```

The dependency chain stays explicit:

```text
source color
    ↓
@scheme-tokens/material3
    ↓
md.sys.color.primary
    ↓
primary
    ↓
--primary
    ↓
shadcn component
```

The Material role names never need to leak into component code.

The mapping above is intentionally policy, not a claim that shadcn/ui and Material define
identical design semantics. Applications can replace any mapping with their own layer or graph
token.

Chart roles such as `chart-1` through `chart-5` are deliberately omitted from this example:
Material's primary, secondary, and tertiary families are not a five-series categorical
visualization palette. Sidebar-specific roles are likewise omitted because they are a separate
application contract rather than automatic aliases of the base roles.

## Layers and overrides

Generated data is ordinary layer data, so normal layer ordering is enough to override it.

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

Later layers win.

No adapter-specific override mechanism is required.

After compilation, provenance still identifies the winning layer and `dependenciesByMode`
records direct reference edges.

## Modes

The graph owns the mode coordinate.

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

Layers do not define their own mode authority. They participate in the modes declared by the
graph.

This lets independently generated or authored layers compose into one finite application
coordinate.

## Public and internal tokens

Visibility is resolved after references.

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

Default compilation selects public tokens. `selection: "all"` compiles everything, while an
exact key selection defines an explicit contract. Exact literal selections preserve finite key
information in TypeScript.

## Deterministic artifacts

Graphs, layers, and compiled schemes have strict versioned artifact forms.

```ts twoslash
import { parseTokenGraph, serializeTokenGraph } from "scheme-tokens";
```

Use the `define*` helpers for trusted TypeScript authoring.

Use:

- `parseTokenGraph()`
- `parseTokenLayer()`
- `parseCompiledScheme()`

for untrusted persisted data.

Canonical serialization is available through:

- `serializeTokenGraph()`
- `serializeTokenLayer()`
- `serializeCompiledScheme()`

Published schemas:

```text
scheme-tokens/schemas/token-graph.v1.schema.json
scheme-tokens/schemas/token-layer.v1.schema.json
scheme-tokens/schemas/compiled-scheme.v1.schema.json
```

## CSS is a projection

The compiler does not turn tokens into CSS implicitly.

`exportCssVars()` is a separate deterministic projection from an already compiled scheme:

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

It returns both emitted CSS and structured data:

```text
exported.value.css
exported.value.blocks
exported.value.variableByToken
```

This keeps token resolution separate from application-owned selector and output policy.

## Why not put color logic in core?

Because token composition and color generation are different problems.

Core owns:

```text
references
modes
layers
visibility
validation
selection
provenance
serialization
CSS projection
```

A generator can own:

```text
color models
palette generation
contrast policy
design-system rules
```

`@scheme-tokens/material3` is the first concrete example of that boundary.

It bundles its pinned Material Color Utilities engine and emits normal `TokenLayer` data. Core
remains independent of Material and continues to treat every resulting color as an opaque
string.

The same compiler can therefore compose Material output, another generator, hand-authored
values, product-specific semantic tokens, or combinations of them.

## How this relates to DTCG

`scheme-tokens` sits upstream of a token interchange or platform build pipeline.

It is concerned with generating and composing the graph before values have been flattened:

```text
generators
    ↓
scheme-tokens
    ↓
resolved semantic scheme
    ↓
CSS or downstream tooling
```

It deliberately does not implement the DTCG `$type` / `$value` authoring model and does not
interpret token value domains.

Tools such as Style Dictionary or Terrazzo can remain downstream consumers when a project
needs platform-specific artifact generation. Or applications can use the built-in CSS
projection directly.

## Public API

The root runtime is intentionally small:

```text
defineTokens
defineTokenGraph
defineTokenLayer
tokenRef

parseTokenGraph
parseTokenLayer
parseCompiledScheme

compileTokenGraph
exportCssVars

serializeTokenGraph
serializeTokenLayer
serializeCompiledScheme
```

Every fallible public operation uses the same result convention:

```ts twoslash
type Result<Value, Problem> =
  | {
      ok: true;
      value: Value;
    }
  | {
      ok: false;
      issues: readonly [Problem, ...Problem[]];
    };
```

## Packages

### `scheme-tokens`

The compiler core.

- zero runtime dependencies
- explicit references
- finite modes
- ordered layers
- public/internal visibility
- deterministic compilation
- provenance and dependency metadata
- strict parsers and canonical serializers
- CSS custom-property projection

### `@scheme-tokens/material3`

Optional Material 3 color generation.

- source-color generation
- 48 finite `md.sys.color.*` roles
- light and dark modes
- custom and exact mode sets
- per-mode source colors
- Material variants
- contrast levels
- supported 2021 and 2025 generation coordinates
- bundled pinned Material Color Utilities engine
- ordinary `TokenLayer` output

See [`packages/material3/README.md`](./packages/material3/README.md) for the full adapter
contract.

## Documentation

- [Public API](./docs/public-api.md)
- [Architecture](./docs/architecture.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [Diagnostics](./docs/diagnostics.md)
- [Value policy](./docs/color-policy.md)
- [Semver](./docs/semver.md)
- [Material 3 adapter](./packages/material3/README.md)
