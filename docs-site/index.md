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

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
  },
});

const scheme = orThrow(compileTokenGraph(graph));
const cssVars = orThrow(exportCssVars(scheme));
const stylesheet = cssVars.css;
```

This uses the [public `orThrow` helper](./reference/diagnostics.md#throwing-at-an-application-boundary)
to keep the first path compact without changing the package's `Result` contract.
