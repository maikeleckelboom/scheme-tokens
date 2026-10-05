# Tailwind CSS v4

Export runtime variables in an application namespace, then map them to Tailwind theme variables.
Use `@theme inline` so utilities read the runtime variable where they are applied.

## Export runtime variables

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "surface.canvas": { light: "oklch(98% 0.01 250)", dark: "oklch(18% 0.02 250)" },
    "action.primary": { light: "oklch(55% 0.2 250)", dark: "oklch(75% 0.14 250)" },
  },
});
const runtimeCss = orThrow(
  exportCssVars(orThrow(compileTokenGraph(graph)), {
    prefix: "app",
    activation: {
      attribute: "data-theme",
      media: { dark: "(prefers-color-scheme: dark)" },
    },
  }),
).css;
```

Load `runtimeCss` with the application. It defines `--app-surface-canvas` and
`--app-action-primary`, follows the system preference, and lets a `data-theme` marker override
it for a subtree.

## Register utilities

In the CSS processed by Tailwind:

```css
@import "tailwindcss";

@theme inline {
  --color-canvas: var(--app-surface-canvas);
  --color-primary: var(--app-action-primary);
}
```

This registers `bg-canvas`, `text-primary`, and other color utilities. `@theme inline` makes them
reference the `--app-*` variables directly, so they use the active theme in their scope.
Token-backed colors switch with the variables; a `dark:` variant is unnecessary for that switch.

Ordinary CSS custom properties alone do not register Tailwind utilities. See Tailwind's
[theme-variable guidance](https://tailwindcss.com/docs/theme#referencing-other-variables) and
[runtime color example](https://tailwindcss.com/docs/colors#referencing-other-variables).

## Allow utilities to override runtime variables

Tailwind places utilities in `@layer utilities`. If a utility sets a runtime custom property,
such as `[--app-surface-canvas:white]`, unlayered generated declarations would take precedence.

Set `cascadeLayer: "theme"` to put tokens in Tailwind's earlier `theme` layer. Normal utility
declarations can then override them.

## Use shadcn variables

For shadcn's `background`, `foreground`, and related roles, expose those names as token keys.
Material roles can supply the values through `tokenRef()`; choose the mapping to fit your
application's semantics. See the
[Material guide](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs-site/guide/material3.md#use-application-names).

Stock `:root` and `.dark` variable declarations have more specificity than generated
`:where(...)` rules. Loading tokens later in the same layer will not override those stock values.

Keep stock values as fallbacks in `@layer base`, then load generated output unlayered or in a
layer ordered after `base`:

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: white;
    --foreground: black;
  }

  .dark {
    --background: black;
    --foreground: white;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}
```

Export matching token keys with
`activation: { selectors: { light: ".light", dark: ".dark" } }`. Including both modes supports
nested light regions inside dark ones.

For layered output, declare `@layer base, tokens;` before either layer appears, then use
`cascadeLayer: "tokens"`. Tailwind's `theme` layer is earlier than `base`, so it does not
override fallbacks in `base`. Removing generated output restores the stock values.
