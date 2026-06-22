# Getting Started

Install the root package.

```sh
pnpm add scheme-tokens
```

Define authored tokens, compile a scheme, then export CSS variables.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

export function createStylesheet(): string {
  const graph = defineTokens({
    background: {
      base: "#ffffff",
      dark: "#111111",
    },
    foreground: {
      base: "#111111",
      dark: "#ffffff",
    },
  });

  const compiled = compileTokenGraph(graph);

  if (!compiled.ok) {
    throw new Error(JSON.stringify(compiled.issues, null, 2));
  }

  const cssExport = exportCssVars(compiled.scheme);

  if (!cssExport.ok) {
    throw new Error(JSON.stringify(cssExport.issues, null, 2));
  }

  return cssExport.css;
}
```
