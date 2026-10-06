# Add Material 3 roles

Install the generator alongside core:

```sh
pnpm add scheme-tokens
pnpm add @scheme-tokens/material3
```

## Generate a layer

<!-- example: material-layer -->

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
```

The layer supplies 48 Material 3 color roles with light and dark mode maps.

## Compose a graph

<!-- example: material-layer -->

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
});
```

The graph owns the mode order and default. Compile it with core and export CSS to produce
`--md-sys-color-*` variables.

## Use application names

Keep generated roles internal when components should depend on your application's semantic names:

<!-- example: material-shadcn -->

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  visibility: "internal",
});
```

Public aliases can reference internal roles. Default compilation resolves those references and
returns only the application tokens.

## Use shadcn names

Compose that internal layer with application aliases matching shadcn's variables:

<!-- example: material-shadcn -->

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

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
```

The mapping is application-owned; adjust role choices to fit your UI semantics. To override a
generated role, declare its key in a later layer or in the graph's tokens. Omitted visibility
keeps the role internal, and components keep using the same public names.

### Compile and activate dark mode

<!-- example: material-shadcn -->

```ts
import { compileTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    activation: {
      selectors: { dark: ".dark" },
    },
  });
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

Load the resulting stylesheet in your application. Light values apply at the root; a `.dark`
element activates dark values for its subtree. Generated selectors use `:where()` with zero
specificity. Compilation and export return structured failures; see
[Diagnostics](../reference/diagnostics.md) for handling them.

### Register Tailwind utilities

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Use `bg-background`, `text-foreground`, or `bg-primary text-primary-foreground` on components.
The [Tailwind/shadcn guide](./tailwind-css-v4.md#use-shadcn-variables) explains how to retain stock
fallbacks, order cascade layers, and activate nested light regions.

## Adjust generation

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  specVersion: "2025",
  variant: "expressive",
  contrastLevel: 0.5,
});
```

The first argument is a six-digit hex source color. Contrast ranges from `-1` to `1`.
The [Material reference](../reference/material3.md#generation-settings) lists variants and defaults.

## Use custom modes

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light-high", "dark-high"],
  defaultMode: "light-high",
  layers: [
    material3("#6750a4", {
      contrastLevel: 1,
      modeSettings: {
        "light-high": { colorMode: "light" },
        "dark-high": { colorMode: "dark" },
      },
    }),
  ],
});
```

`modeSettings` replaces the default mode pair. Its keys match the graph's modes, and custom names
require `colorMode`. Each mode can override source color, variant, and contrast.

Continue with [CSS activation](./export-css-variables.md#use-theme-activation),
[application theme coordinates](./application-theme-coordinates.md), or
[Material's TypeScript contract](../reference/material3.md#typescript).
