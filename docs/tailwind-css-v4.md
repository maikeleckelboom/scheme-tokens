# Tailwind CSS v4

Define application tokens, compile their values, and export runtime CSS variables. Bridge those
variables to Tailwind utilities with `@theme inline` so each utility reads the active value in
its own scope. The [shadcn section](#use-shadcn-variables) applies the same flow to Material-backed
application aliases.

## Define application tokens

<!-- example: tailwind-runtime -->

```ts
import { defineTokenGraph } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    "surface.canvas": {
      light: "oklch(98% 0.01 250)",
      dark: "oklch(18% 0.02 250)",
    },
    "action.primary": {
      light: "oklch(55% 0.2 250)",
      dark: "oklch(75% 0.14 250)",
    },
  },
});
```

## Compile the graph

<!-- example: tailwind-runtime -->

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph);
```

Compilation resolves the values for each mode. It returns a `Result`; see
[Diagnostics](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs/diagnostics.md)
for structured failures.

## Export runtime variables

<!-- example: tailwind-runtime -->

```ts
import { exportCssVars } from "scheme-tokens";

if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    prefix: "app",
    activation: {
      attribute: "data-theme",
      media: {
        dark: "(prefers-color-scheme: dark)",
      },
    },
  });
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

Load `exported.value.css` with the application after successful export. It defines
`--app-surface-canvas` and `--app-action-primary`, follows the system preference, and lets a
`data-theme` marker override it for a subtree.

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

The [Material application-alias example](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs-site/guide/material3.md#use-shadcn-names)
keeps generated Material roles internal and exposes `background`, `foreground`, `primary`,
and the other shadcn roles through `tokenRef()`. Default compilation selects those aliases;
CSS export produces `--background`, `--foreground`, `--primary`, and their companion variables.
Use no prefix for these names.

For the usual light-root / dark-subtree setup, export with
`activation: { selectors: { dark: ".dark" } }`. Connect the resulting variables to Tailwind:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Material generation supplies the roles, application aliases name them, and `@theme inline`
makes them available as `bg-background`, `text-foreground`, and
`bg-primary text-primary-foreground`. Repeat the bridge for the remaining semantic colors used
by your components.

### Keep stock values as fallbacks

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
```

Retain the `@theme inline` bridge above. For layered output, declare `@layer base, tokens;`
before either layer appears, then use `cascadeLayer: "tokens"`. Tailwind's `theme` layer is
earlier than `base`, so it does not override fallbacks in `base`.

### Activate nested light regions

If the UI needs an explicit light region inside a dark one, export both selectors:
`activation: { selectors: { light: ".light", dark: ".dark" } }`. Apply `.light` to that region;
its declarations replace the inherited dark values for its subtree.

### Restore fallbacks

Removing the generated stylesheet restores the stock values in `@layer base`. Keep those
declarations and the Tailwind bridge loaded independently of the generated output.
