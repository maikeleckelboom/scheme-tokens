# Export CSS Variables

Compile first, then export CSS variables from the compiled scheme.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const css = cssExport.value.css;
const blocks = cssExport.value.blocks;
const variableByToken = cssExport.value.variableByToken;

export { blocks, css, variableByToken };
```

The default output uses token keys directly:

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
}
```

Pass a prefix when a project needs namespaced variables:

```ts
const prefixed = exportCssVars(compiled.value, {
  prefix: "theme",
});

export { prefixed };
```

The exporter validates CSS custom-property names and duplicate generated names. It emits compiled string values without
rewriting them.
