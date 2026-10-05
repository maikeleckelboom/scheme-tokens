---
layout: home
hero:
  name: scheme-tokens
  text: Compile tokens into CSS variables
  tagline: Define string values, references, modes, and layers in TypeScript.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /reference/api
---

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  orThrow,
  tokenRef,
} from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    primary: tokenRef("brand.600"),
  },
});

const scheme = orThrow(compileTokenGraph(graph));
const css = orThrow(exportCssVars(scheme)).css;
```

A graph describes the tokens and their relationships. Compilation resolves those relationships
into values; CSS export turns the values into custom properties.

Start with [your first stylesheet](./guide/getting-started.md), then add
[modes and layers](./guide/define-tokens.md) or
[Material 3 colors](./guide/material3.md).
