# scheme-tokens

Define color tokens once. Compile the selected graph. Export deterministic CSS variables and keep typed data available
to TypeScript.

Root values are authored CSS strings. They are preserved and emitted unchanged; root does not parse, normalize, convert,
or format color values.

## First Path

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
  primary: "#6750a4",
  "primary-foreground": "#ffffff",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const stylesheet = cssExport.value.css;
//    ^?

export { stylesheet };
```

## What Root Owns

- Token graph contracts.
- JSON-safe authoring helpers.
- Graph parsing and validation.
- Token compilation.
- Deterministic serialization.
- CSS custom-property export.
- `Result` and `Issue` contracts.
- Adapter interfaces.

## What Root Does Not Own

- CSS color grammar.
- Color conversion.
- Palette generation.
- Browser style mutation.
- Framework-specific scaffolds.
- Optional engine dependencies.

## Next

- [Getting Started](./guide/getting-started.md)
- [Define Tokens](./guide/define-tokens.md)
- [Export CSS Variables](./guide/export-css-variables.md)
- [TypeScript Access](./guide/typescript-access.md)
- [Material 3](./guide/material-3.md)
- [API Reference](./reference/api.md)
- [Diagnostics](./reference/diagnostics.md)
