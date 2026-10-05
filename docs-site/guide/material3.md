# Add Material 3 roles

Install the generator alongside core:

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

## Generate colors

```ts
import { material3 } from "@scheme-tokens/material3";
import { compileTokenGraph, defineTokenGraph, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4")],
});

const scheme = orThrow(compileTokenGraph(graph));
const primary = scheme.tokens["md.sys.color.primary"].light;
```

The layer supplies 48 color roles for light and dark modes. The graph defines their order and
default. Pass the compiled scheme to `exportCssVars()` to produce `--md-sys-color-*` variables.

## Use application names

Keep the generated roles internal and reference them from public application tokens:

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material3("#6750a4", { visibility: "internal" })],
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "surface.foreground": tokenRef("md.sys.color.on-surface"),
    "action.primary.background": tokenRef("md.sys.color.primary"),
    "action.primary.foreground": tokenRef("md.sys.color.on-primary"),
  },
});
```

Default compilation returns the application tokens. To override a generated role, declare the
same key in a later layer or in the graph's tokens. Omitted visibility keeps that role internal.

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
