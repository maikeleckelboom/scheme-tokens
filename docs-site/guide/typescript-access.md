# TypeScript Access

Compiled schemes are ordinary typed data.

```ts
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const background = compiled.value.tokens.background.valueByMode.base;
const primary = compiled.value.tokens.primary.valueByMode.base;

export { background, primary };
```

The compiled values are the authored strings. This makes the compiled scheme useful for CSS export, previews, and other
application code that needs the same token contract without parsing CSS text.

Use `serializeCompiledScheme()` when another process should consume the compiled artifact:

```ts
import { compileTokenGraph, defineTokens, serializeCompiledScheme } from "scheme-tokens";

const graph = defineTokens({ background: "#ffffff" });
const compiled = compileTokenGraph(graph);

const json = compiled.ok ? serializeCompiledScheme(compiled.value) : undefined;

export { json };
```
