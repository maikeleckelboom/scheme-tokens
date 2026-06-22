---
layout: home
hero:
  name: scheme-tokens
  text: Token graph compiler
  tagline: Define authored tokens, compile deterministic schemes, and export CSS variables.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API
      link: /reference/api
---

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

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

const background = compiled.scheme.tokens.background.base;

const cssExport = exportCssVars(compiled.scheme);

if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.css;
```
