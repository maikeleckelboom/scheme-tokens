# @scheme-tokens/material3

Generate 48 Material 3 system color roles from a source color and use them as a `scheme-tokens`
layer. Values are lowercase six-digit hex strings, with `light` and `dark` modes by default.

## Install

```sh
pnpm add scheme-tokens
pnpm add @scheme-tokens/material3
```

Material `0.2.0` requires `scheme-tokens: ^0.4.0`. Both packages are ESM-only and support browsers
and Node.js 24 or newer. See the [TypeScript guide](../../docs-site/guide/typescript-access.md)
for supported compiler versions.

## Generate a layer

<!-- example: material-layer -->

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4");
```

The layer includes roles such as `md.sys.color.primary`, `md.sys.color.on-primary`,
`md.sys.color.surface`, and `md.sys.color.outline`. It has the ID `material3` and public visibility.

## Compose a graph

The graph declares the modes and their default, then composes the generated layer:

<!-- example: material-layer -->

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
});
```

Compile this graph with core, then export CSS or serialize the resolved scheme. Default CSS names
follow the role names, for example `--md-sys-color-primary`.

## Expose application aliases

Keep Material roles internal while your application exposes stable semantic names. For shadcn/ui,
use names such as `background`, `foreground`, and `primary`:

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", {
  visibility: "internal",
});

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  layers: [material],
  tokens: {
    background: tokenRef("md.sys.color.background"),
    foreground: tokenRef("md.sys.color.on-background"),
    primary: tokenRef("md.sys.color.primary"),
    "primary-foreground": tokenRef("md.sys.color.on-primary"),
  },
});
```

Default compilation resolves the internal roles and returns the public aliases. Add authored
layers after Material to override role values; graph-local declarations take precedence over
every layer. An override keeps a role's visibility unless it specifies a new one.

The mapping is application-owned. The [core README](../../README.md#material-3-with-shadcnui)
shows the full shadcn mapping and `.dark` activation; the
[Material guide](../../docs-site/guide/material3.md#use-shadcn-names) walks through CSS export.
The [Tailwind/shadcn guide](../../docs/tailwind-css-v4.md#use-shadcn-variables) connects
`--background` and `--primary` to utilities such as `bg-background` and `bg-primary`.

## Variants and contrast

```ts
import { material3 } from "@scheme-tokens/material3";

const material = material3("#6750a4", {
  specVersion: "2025",
  variant: "expressive",
  contrastLevel: 0.5,
});
```

| Setting         | Default                 | Per-mode override |
| --------------- | ----------------------- | ----------------- |
| `sourceColor`   | Required first argument | Yes               |
| `variant`       | `tonal-spot`            | Yes               |
| `contrastLevel` | `0`                     | Yes               |
| `specVersion`   | `2021`                  | No                |
| `visibility`    | `public`                | No                |

Source colors must use `#RRGGBB` notation. Contrast ranges from `-1` to `1`. The 2025 spec supports
`neutral`, `tonal-spot`, `vibrant`, and `expressive`; see the
[Material reference](../../docs-site/reference/material3.md#generation-settings) for the full
variant list and input rules.

## Configure modes

`modeSettings` replaces the default light/dark set. Its keys must match the graph's modes.
Each entry can override source color, variant, and contrast independently:

```ts
import { material3, type Material3ModeSettings } from "@scheme-tokens/material3";
import { defineTokenGraph } from "scheme-tokens";

const modeSettings = {
  "light-high": { colorMode: "light", contrastLevel: 1 },
  "brand-dark": { colorMode: "dark", sourceColor: "#009489" },
} satisfies Material3ModeSettings<"light-high" | "brand-dark">;

const graph = defineTokenGraph({
  modes: ["light-high", "brand-dark"],
  defaultMode: "light-high",
  layers: [material3("#6750a4", { modeSettings })],
});
```

`light` and `dark` imply their `colorMode`. Custom names require it. A single-mode map is valid;
an empty map is rejected.

## TypeScript behavior

Inline settings preserve the role keys, modes, and visibility. Use `satisfies Material3Options`
to check a settings object while retaining its literals. A variable annotated as
`Material3Options` leaves visibility uncertain, so public compilation remains partial.

Custom mode types require `modeSettings`; types that exclude public visibility require
`visibility`. Narrow possibly undefined options or provide a valid fallback before calling
`material3()`. The [TypeScript reference](../../docs-site/reference/material3.md#typescript)
covers generic wrappers and the return type.

## Reference and licensing

- [Material guide](../../docs-site/guide/material3.md)
- [Material API, roles, and errors](../../docs-site/reference/material3.md)
- [CSS export](../../docs-site/guide/export-css-variables.md)

The package bundles Material Color Utilities `0.4.0` and is licensed under MIT and Apache-2.0.
See [LICENSE](./LICENSE), [LICENSE-MATERIAL-COLOR-UTILITIES](./LICENSE-MATERIAL-COLOR-UTILITIES),
and [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
