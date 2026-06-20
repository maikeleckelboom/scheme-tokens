# Light and Dark

Use modes when the same token has different values across color schemes.

## Define Modes

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  {
    background: {
      light: "#ffffff",
      dark: "#141218",
    },
    foreground: {
      light: "#111111",
      dark: "#f5eff7",
    },
    primary: {
      light: "#6750a4",
      dark: "#d0bcff",
    },
    "primary-foreground": {
      light: "#ffffff",
      dark: "#381e72",
    },
  },
  {
    modes: ["light", "dark"],
    defaultMode: "light",
  },
);

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
export { stylesheet };
```

The default mode exports at `:root`. Other modes use `data-color-scheme` on the same scope:

```css
:root {
  --background: #ffffff;
}

:root[data-color-scheme="dark"] {
  --background: #141218;
}
```

Mode names are color-scheme modes. They are not gamut variants, Material variants, or browser capability flags.

## Use Exact Selectors

Use exact selectors when your app already owns classes, selector lists, or descendant selectors.

```ts
import { exportCssVars, type CompiledColorScheme } from "scheme-tokens";

export function exportThemeCss(compiled: CompiledColorScheme): string {
  const cssExport = exportCssVars(compiled, {
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ':root, [data-theme="light"]',
        dark: ".dark",
      },
    },
  });

  if (!cssExport.ok) {
    throw new Error(JSON.stringify(cssExport.issues, null, 2));
  }

  return cssExport.value.css;
}
```

Generated `data-attribute` and `class` selectors append to a simple scope such as `:root` or `.preview`. Use exact
selectors for complex scopes.
