# scheme-tokens

`scheme-tokens` composes and resolves string-valued token graphs with explicit references,
modes, ordered layers, and visibility. Export the resolved values as CSS custom properties.

## Install

```sh
pnpm add scheme-tokens
```

The package is ESM-only and runs in browsers and Node.js 24 or newer. TypeScript support starts at
5.9.3, 6.0.2, and 7.0.2 for their respective major versions; see the
[TypeScript guide](./docs-site/guide/typescript-access.md).

## Define a graph

<!-- example: first-graph -->

<!-- prettier-ignore -->
```ts
import {
  defineTokenGraph,
  tokenRef,
} from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    background: "#ffffff",
    primary: tokenRef("brand.600"),
  },
});
```

Bare strings are literal values. `tokenRef()` connects one token to another. Graphs use a single
`base` mode by default.

## Compile the graph

<!-- example: first-graph -->

<!-- prettier-ignore -->
```ts
import {
  compileTokenGraph,
} from "scheme-tokens";

const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  console.log(
    compiled.value.tokens.primary.base,
  ); // "#6750a4"
}
```

Compilation resolves references for each mode. It returns a `Result`: successful values are in
`compiled.value`, and failures contain structured issues. See [Diagnostics](./docs/diagnostics.md)
for failure handling.

## Export CSS

Continue with the compiled result:

<!-- example: first-graph -->

<!-- prettier-ignore -->
```ts
import {
  exportCssVars,
} from "scheme-tokens";

if (compiled.ok) {
  const exported = exportCssVars(
    compiled.value,
  );
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

```css
:where(:root) {
  --background: #ffffff;
  --brand-600: #6750a4;
  --primary: #6750a4;
}
```

Load the stylesheet in your application and use `var(--primary)`. Token keys become CSS variable
names by joining their dot-separated segments with hyphens: `surface.canvas` becomes
`--surface-canvas`. CSS export also returns a `Result`.

## Add modes

<!-- prettier-ignore -->
```ts
import {
  defineTokenGraph,
} from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    background: {
      light: "#ffffff",
      dark: "#111111",
    },
    spacing: "8px",
  },
});
```

The graph defines the modes and their default. A mode map supplies a value for every mode;
a direct value such as `spacing` applies to all of them. The
[CSS guide](./docs-site/guide/export-css-variables.md) shows system preferences, theme markers,
and selector activation.

## Compose layers

<!-- prettier-ignore -->
```ts
import {
  defineTokenGraph,
  defineTokenLayer,
  tokenRef,
} from "scheme-tokens";

const brand = defineTokenLayer({
  id: "brand",
  defaultVisibility: "internal",
  tokens: { "brand.600": "#6750a4" },
});

const graph = defineTokenGraph({
  layers: [brand],
  tokens: {
    primary: tokenRef("brand.600"),
  },
});
```

Layers compose in array order, followed by the graph's own tokens. Later declarations replace
earlier values. An override keeps the existing visibility unless it sets `visibility` explicitly.

Compilation selects public tokens by default, so `primary` resolves through `brand.600` while the
source stays internal. Use `selection: "all"` to include internal tokens, or a key array to choose
the output. See [Define tokens](./docs-site/guide/define-tokens.md) for composition and visibility.

## Add Material 3 colors

```sh
pnpm add @scheme-tokens/material3
```

<!-- example: material-shadcn -->

<!-- prettier-ignore -->
```ts
import {
  material3,
} from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  visibility: "internal",
});
```

`@scheme-tokens/material3` generates 48 Material 3 color roles as a layer. The default mode maps
use `light` and `dark`; the application graph owns the mode order and default. Keep the generated
roles internal and expose application names through references.

## Material 3 with shadcn/ui

Compose the Material layer and map its roles to shadcn/ui's semantic names:

<!-- example: material-shadcn -->

<!-- prettier-ignore -->
```ts
import {
  defineTokenGraph,
  tokenRef,
} from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
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
    "secondary-foreground": tokenRef(
      "md.sys.color.on-secondary-container",
    ),
    muted: tokenRef("md.sys.color.surface-container-low"),
    "muted-foreground": tokenRef(
      "md.sys.color.on-surface-variant",
    ),
    accent: tokenRef("md.sys.color.surface-container-high"),
    "accent-foreground": tokenRef("md.sys.color.on-surface"),
    destructive: tokenRef("md.sys.color.error"),
    "destructive-foreground": tokenRef("md.sys.color.on-error"),
    border: tokenRef("md.sys.color.outline-variant"),
    input: tokenRef("md.sys.color.outline"),
    ring: tokenRef("md.sys.color.primary"),
  },
});
```

The mapping is application-owned; adjust role choices to fit your UI semantics. Default
compilation resolves the internal roles and emits the public aliases. You can replace the source
layer or override its roles while keeping the names used by your components.

Compile this graph and configure dark activation:

<!-- example: material-shadcn -->

<!-- prettier-ignore -->
```ts
import {
  compileTokenGraph,
  exportCssVars,
} from "scheme-tokens";

const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  const exported = exportCssVars(
    compiled.value,
    {
      activation: {
        selectors: { dark: ".dark" },
      },
    },
  );
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

Light values are emitted at the root. `.dark` activates dark values for that subtree; generated
selectors use `:where()` with zero specificity. Load the generated CSS and bridge the semantic
variables to Tailwind v4:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
}
```

Components can now use `bg-background`, `text-foreground`, and `bg-primary`. The
[Tailwind/shadcn guide](./docs/tailwind-css-v4.md#use-shadcn-variables) covers stock fallback
variables, cascade layers, and nested light regions. See the
[Material guide](./docs-site/guide/material3.md) for variants, contrast, and custom modes.

## Further reading

- [Getting started](./docs-site/guide/getting-started.md)
- [API reference](./docs-site/reference/api.md), [CSS reference](./docs-site/reference/css.md),
  and [diagnostics](./docs/diagnostics.md)
- [Application theme coordinates](./docs/application-theme-coordinates.md)
- [TypeScript access](./docs-site/guide/typescript-access.md)
- [Architecture](./docs/architecture.md), [development](./docs/development.md), and
  [versioning](./docs/semver.md)

For persisted data, use the parsers and serializers described in the
[artifact reference](./docs-site/reference/api.md#artifacts-and-schemas). To pass compiled tokens
to a tool such as Style Dictionary or Terrazzo, map them to that tool's input format.
