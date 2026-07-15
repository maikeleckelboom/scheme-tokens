---
layout: home
hero:
  name: scheme-tokens
  text: String-valued token graph compiler
  tagline: Define explicit graphs, compile deterministic schemes, and export CSS custom properties.
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
  background: "#ffffff",
  foreground: "#111111",
});

const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const exported = exportCssVars(compiled.value);

if (!exported.ok) {
  throw new Error(JSON.stringify(exported.issues, null, 2));
}

const stylesheet = exported.value.css;
```
