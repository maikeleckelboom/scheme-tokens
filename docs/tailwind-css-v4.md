# Tailwind CSS v4

Keep scheme-tokens runtime properties in an application-owned namespace, then bridge selected semantic
roles into Tailwind's theme namespace. The layers have separate jobs:

```text
scheme-tokens runtime variables
        -> @theme inline semantic bridge
        -> Tailwind color utilities
```

First compile and export the runtime variables. The default name encoder joins the prefix and the
token-key segments with single hyphens, the same convention Tailwind uses, so with `prefix: "app"`
`surface.canvas` becomes `--app-surface-canvas` without a naming callback. Structurally different keys
that would share a name, such as `surface.canvas-alt` and `surface-canvas.alt`, fail the export with
`duplicate-css-variable` instead of overwriting each other.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "surface.canvas": {
      light: "oklch(98% 0.01 250)",
      dark: "oklch(18% 0.02 250)",
    },
    "action.primary.background": {
      light: "oklch(55% 0.2 250)",
      dark: "oklch(75% 0.14 250)",
    },
  },
});

const publicKeys = ["surface.canvas", "action.primary.background"] as const;
const scheme = orThrow(
  compileTokenGraph(graph, {
    selection: { keys: publicKeys },
  }),
);
const runtime = orThrow(
  exportCssVars(scheme, {
    prefix: "app",
    system: { dark: "(prefers-color-scheme: dark)" },
  }),
);

const runtimeCss = runtime.css;
```

Serve or inject `runtimeCss` with the application. It follows the system preference, and a
`data-theme` marker on any element overrides it for that subtree:

```css
:where(:root) {
  --app-action-primary-background: oklch(55% 0.2 250);
  --app-surface-canvas: oklch(98% 0.01 250);
}

@media (prefers-color-scheme: dark) {
  :where(:root) {
    --app-action-primary-background: oklch(75% 0.14 250);
    --app-surface-canvas: oklch(18% 0.02 250);
  }
}

:where([data-theme="light"]) {
  --app-action-primary-background: oklch(55% 0.2 250);
  --app-surface-canvas: oklch(98% 0.01 250);
}

:where([data-theme="dark"]) {
  --app-action-primary-background: oklch(75% 0.14 250);
  --app-surface-canvas: oklch(18% 0.02 250);
}
```

Then define a stable semantic bridge in the CSS processed by Tailwind:

```css
@import "tailwindcss";

@theme inline {
  --color-canvas: var(--app-surface-canvas);
  --color-primary: var(--app-action-primary-background);
}
```

The `@theme` color names register utilities such as `bg-canvas` and `bg-primary`. Ordinary variables
declared outside `@theme`, including arbitrary `--color-*` variables, do not register Tailwind
utilities by themselves, which is why the runtime variables keep their own `--app-*` namespace.

The `inline` option makes each generated utility reference the underlying `--app-*` property directly
instead of resolving through an intermediate `--color-*` property. A nested element under
`[data-theme="dark"]` therefore resolves the runtime value in that scope, and token-backed utilities
switch modes without `dark:` variants. This follows Tailwind's official guidance for
[referencing other theme variables](https://tailwindcss.com/docs/theme#referencing-other-variables)
and its [runtime color-variable pattern](https://tailwindcss.com/docs/colors#referencing-other-variables).

Tailwind places its utilities in `@layer utilities`, and unlayered CSS beats every cascade layer.
Served unlayered, the token declarations would therefore win over a utility that sets the same custom
property, such as `[--app-surface-canvas:white]`, although their selectors have zero specificity. Pass
`cascadeLayer: "theme"` to emit them inside Tailwind's `theme` layer, which Tailwind orders before
`utilities`, so utilities override them.
