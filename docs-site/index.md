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
// ---cut-start---
import type { Issue, Result } from "scheme-tokens";
declare function orThrow<Value, Problem extends Issue>(result: Result<Value, Problem>): Value;
// ---cut-end---
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
});

const scheme = orThrow(compileTokenGraph(graph));
const cssVars = orThrow(exportCssVars(scheme));
const stylesheet = cssVars.css;
```

This uses an [application-local `orThrow()` helper](./reference/diagnostics.md#application-local-orthrow)
to keep the first path compact without changing the package's `Result` contract.
