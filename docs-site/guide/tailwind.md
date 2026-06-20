# Tailwind

Tailwind integration is an explicit mapping recipe.

`scheme-tokens` owns authored runtime CSS custom properties. Tailwind owns the `--color-*` custom properties it uses to
generate utilities. Keep those contracts separate.

## Build Runtime Custom Properties

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

export function buildRuntimeCss(): string {
  const graph = defineTokens({
    background: "#ffffff",
    foreground: "#111111",
    primary: "#6750a4",
    "primary-foreground": "#ffffff",
  });

  const compiled = compileTokenGraph(graph);
  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.issues, null, 2));
  }

  const cssExport = exportCssVars(compiled.value);
  if (!cssExport.ok) {
    throw new Error(JSON.stringify(cssExport.issues, null, 2));
  }

  return cssExport.value.css;
}
```

Generated runtime CSS:

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

## Map Into Tailwind

Add Tailwind's theme mapping in your app CSS:

```css
@import "./tokens.css";
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

Do not make Tailwind's `--color-*` namespace the `scheme-tokens` default. Map the color tokens your Tailwind contract
needs, and leave other runtime CSS custom properties alone.
