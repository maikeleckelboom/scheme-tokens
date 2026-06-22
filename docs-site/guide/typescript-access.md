# TypeScript Access

Literal token keys and modes flow through the authoring helpers.

```ts
import { compileTokenGraph, defineTokens, serializeCompiledScheme } from "scheme-tokens";

const graph = defineTokens({
  background: {
    base: "#ffffff",
    dark: "#111111",
  },
  primary: {
    base: "#6750a4",
    dark: "#d0bcff",
  },
});

const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  const background = compiled.scheme.tokens.background.base;
  const primary = compiled.scheme.tokens.primary.dark;
  const metadata = compiled.scheme.metadataByToken.primary.dependenciesByMode.dark;
  const json = serializeCompiledScheme(compiled.scheme);

  background.toUpperCase();
  primary.toUpperCase();
  metadata.length.toFixed();
  json.toUpperCase();
}
```
