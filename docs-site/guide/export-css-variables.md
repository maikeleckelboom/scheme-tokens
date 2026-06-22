# Export CSS Variables

`exportCssVars()` accepts a compiled scheme and returns direct CSS export fields.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: {
      base: "#ffffff",
      dark: "#111111",
    },
  }),
);

if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.scheme);

if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const css = cssExport.css;
const blocks = cssExport.blocks;
const variableByToken = cssExport.variableByToken;
```

Use a prefix when the emitted custom properties need a namespace.

```text
const prefixed = exportCssVars(compiled.scheme, {
  prefix: "theme",
});

if (prefixed.ok) {
  prefixed.variableByToken.background;
}
```
