# Getting Started

Install the dependency-light root package.

```sh
pnpm add scheme-tokens
```

Define string-valued tokens, compile the graph, then export CSS custom properties.

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

export function createStylesheet(): string {
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

  return exported.value.css;
}
```

Without mode options, `defineTokens()` creates the single `base` mode. Continue with [Define Tokens](./define-tokens.md) for explicit modes, references, metadata, visibility, and layers.
