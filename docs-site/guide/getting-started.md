# Getting Started

This page builds one useful artifact: CSS custom properties from direct token values.

## Install

```bash
pnpm add scheme-tokens
```

## Define, Compile, Export

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

export function buildTokenCss(): string {
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

Use the generated CSS variables in app CSS:

```css
.surface {
  background: var(--background);
  color: var(--foreground);
}

.button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

`defineTokens()` is the smallest authoring helper. With no mode options it creates one mode named `base`.

`compileTokenGraph()` validates token names, references, modes, and selection.

`exportCssVars()` renders the compiled strings into deterministic CSS custom properties.

Root preserves color strings as authored. If an app writes `"#6750a4"`, that is the value root compiles and exports.
