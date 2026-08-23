# Tailwind CSS v4

Keep scheme-tokens runtime properties in an application-owned namespace, then bridge selected semantic
roles into Tailwind's theme namespace. The layers have separate jobs:

```text
scheme-tokens runtime variables
        -> @theme inline semantic bridge
        -> Tailwind color utilities
```

First compile and export the runtime variables. Supplying `prefix: "app"` uses the package's default
segment-preserving name encoder, so `surface.canvas` becomes `--app-surface--canvas`. Do not replace it
with a generic `segments.join("-")`: that would lose token-segment boundaries and can make structurally
different keys collide.

```ts twoslash
// ---cut-start---
import type { Issue, Result } from "scheme-tokens";
declare function orThrow<Value, Problem extends Issue>(result: Result<Value, Problem>): Value;
// ---cut-end---
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  {
    "surface.canvas": {
      light: "oklch(98% 0.01 250)",
      dark: "oklch(18% 0.02 250)",
    },
    "action.primary.background": {
      light: "oklch(55% 0.2 250)",
      dark: "oklch(75% 0.14 250)",
    },
  },
  { modes: ["light", "dark"], defaultMode: "light" },
);

const publicKeys = ["surface.canvas", "action.primary.background"] as const;
const scheme = orThrow(
  compileTokenGraph(graph, {
    selection: { keys: publicKeys },
  }),
);
const runtime = orThrow(
  exportCssVars(scheme, {
    prefix: "app",
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ":root",
        dark: '[data-scheme="dark"]',
      },
    },
  }),
);

const runtimeCss = runtime.css;
```

Serve or inject `runtimeCss` with the application. Its custom properties retain the semantic token
segments:

```css
:root {
  --app-action--primary--background: oklch(55% 0.2 250);
  --app-surface--canvas: oklch(98% 0.01 250);
}
[data-scheme="dark"] {
  --app-action--primary--background: oklch(75% 0.14 250);
  --app-surface--canvas: oklch(18% 0.02 250);
}
```

Then define a stable semantic bridge in the CSS processed by Tailwind:

```css
@import "tailwindcss";

@theme inline {
  --color-canvas: var(--app-surface--canvas);
  --color-primary: var(--app-action--primary--background);
}
```

The `@theme` color names register utilities such as `bg-canvas` and `bg-primary`. Ordinary variables
declared only under `:root`, including arbitrary `--color-*` variables, do not register Tailwind
utilities by themselves.

The `inline` option makes each generated utility reference the underlying `--app-*` property directly
instead of resolving through an intermediate `--color-*` property. A nested element under
`[data-scheme="dark"]` therefore resolves the runtime value in that scope. This follows Tailwind's
official guidance for [referencing other theme variables](https://tailwindcss.com/docs/theme#referencing-other-variables)
and its [runtime color-variable pattern](https://tailwindcss.com/docs/colors#referencing-other-variables).
