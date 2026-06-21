# Getting Started

This page builds one useful artifact: CSS custom properties from direct color tokens.

## Install

```bash
pnpm add scheme-tokens
```

## Define, Compile, Export

```ts
import { writeFile } from "node:fs/promises";
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "oklch(0.54 0.16 285)",
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

const stylesheet = cssExport.value.css;
await writeFile("src/styles/tokens.css", stylesheet);
```

Use the generated CSS custom properties in app CSS:

```css
.page {
  background: var(--background);
  color: var(--foreground);
}

.button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

`defineTokens()` is the smallest authoring helper. With no mode options it creates one mode named `base`.

`compileTokenGraph()` validates token keys, colors, references, modes, and the selected tokens. The default selection
is public tokens.

`exportCssVars()` returns a `Result`. In this first path, use the success value's `css` field as the stylesheet
artifact.

## Return CSS From a Build Function

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

export function buildTokenCss(): string {
  const graph = defineTokens({
    background: "#ffffff",
    foreground: "#111111",
    accent: "color(display-p3 0.42 0.32 0.74)",
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

Direct colors can use supported CSS color strings such as hex, `rgb()`, `hsl()`, OKLCH, and `color(display-p3 ...)`.
Public product roles can stay direct like this, or reference implementation tokens explicitly with `tokenRef(...)`.
