# @scheme-tokens/material3

Generate the accepted Material 3 system color roles as an ordinary `scheme-tokens` layer. The
adapter is optional: core remains a string-token compiler and does not install a color engine.

```sh
pnpm add scheme-tokens @scheme-tokens/material3
```

## Generate and compose

```ts
import { material3 } from "@scheme-tokens/material3";
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const material = material3("#6750a4");

const graph = defineTokenGraph({
  ...material,
  tokens: {
    "surface.canvas": tokenRef("md.sys.color.surface"),
    "action.primary.background": tokenRef("md.sys.color.primary"),
  },
});
```

The default call generates complete `light` and `dark` mode maps for 48 `md.sys.color.*` roles,
uses `light` as the default mode, and creates the fixed `material3` layer with public visibility.
Use internal visibility when Material roles are implementation sources for public semantic tokens:

```ts
const material = material3("#6750a4", { visibility: "internal" });
```

## Modes and generation coordinates

`modes` keeps the built-in `light` and `dark` modes, patches either one, and can add custom modes.
Every custom mode requires an explicit appearance.

```ts
const material = material3("#6750a4", {
  variant: "neutral",
  contrastLevel: 0,
  modes: {
    dark: { variant: "expressive" },
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

`exactModes` replaces the complete mode set and requires an explicit default:

```ts
const material = material3("#6750a4", {
  exactModes: {
    standard: { appearance: "light" },
    inverse: { appearance: "dark", contrastLevel: 0.5 },
  },
  defaultMode: "standard",
});
```

Source colors must match `#[0-9a-fA-F]{6}` exactly. Contrast is finite and inclusive from `-1` to
`1`. The default variant is `tonal-spot`, the default spec is `2021`, and generation is phone-only.
Requested 2021 supports all nine variants. Requested 2025 supports only `neutral`, `tonal-spot`,
`vibrant`, and `expressive`; the adapter rejects `monochrome`, `fidelity`, `content`, `rainbow`, and
`fruit-salad` because the pinned engine would silently fall back to effective 2021 behavior.

## Overrides, CSS, and artifacts

Use a later core layer for ordinary overrides:

```ts
import { defineTokenGraph, defineTokenLayer, tokenRef } from "scheme-tokens";

const material = material3("#6750a4", { visibility: "internal" });
const overrides = defineTokenLayer({
  id: "brand-overrides",
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

Material-compatible CSS property names stay a consumer-owned core projection:

```ts
import { compileTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(graph, { selection: "all" });
if (compiled.ok) {
  const css = exportCssVars(compiled.value, {
    variableName: ({ segments }) => `--${segments.join("-")}`,
  });

  if (css.ok) {
    css.value.variableByToken["md.sys.color.primary"];
    // --md-sys-color-primary
  }
}
```

The generated layer is normal core data. `serializeTokenLayer()` provides deterministic reviewable
JSON. After compilation, `metadataByToken[key].origin` identifies the winning layer and
`dependenciesByMode` records direct reference edges. The adapter adds no serializer, CSS exporter,
or provenance API of its own.

## Distribution

The ESM-only package requires Node 22 or newer. Material Color Utilities 0.4.0 is pinned and bundled
into the adapter; `scheme-tokens` remains the shared peer dependency. The package is licensed under
MIT and Apache-2.0 terms because of the bundled engine. See `LICENSE`,
`LICENSE-MATERIAL-COLOR-UTILITIES`, and `THIRD_PARTY_NOTICES.md`.
