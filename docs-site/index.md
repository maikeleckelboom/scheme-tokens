# scheme-tokens

Own your color token names. Compile the selected scheme. Export deterministic CSS custom properties.

For apps that want stable color contracts without adopting a runtime theme engine. Start with manual colors, then add
Material only when a real generator is needed.

## Install

```bash
pnpm add scheme-tokens
```

## First Path

```ts
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

export { stylesheet };
```

## Why It Fits

- Author colors directly: keep product token names in the app contract from the first file.
- Compile deterministic output: resolve the selected scheme before CSS or JSON leaves the package.
- Add generators without coupling: optional engines live in adapter packages, not the root import.

Use the stylesheet artifact in a build step, SSR response, or app CSS import:

```css
@import "./tokens.css";

.button {
  background: var(--primary);
  color: var(--primary-foreground);
}

.surface {
  background: var(--background);
  color: var(--foreground);
}
```

The default export uses authored runtime custom-property names:

```css
:root {
  --background: #ffffff;
  --foreground: #111111;
  --primary: #6750a4;
  --primary-foreground: #ffffff;
}
```

## Go Next

- [Getting Started](./guide/getting-started.md) keeps the direct-token path short.
- [Light and Dark](./guide/light-dark.md) adds modes and selector control.
- [Material 3](./guide/material-3.md) uses the optional adapter without making it the default path.
- [Tailwind](./guide/tailwind.md) maps runtime custom properties into Tailwind's `@theme` contract.
- [Recipes](./recipes/index.md) gives compact copy-paste snippets.
- [API Reference](./reference/api.md) lists the root exports.
- [Schema Reference](./reference/schemas.md) covers strict persisted artifacts.

## What It Owns

The root package gives you the core color-token path: strict graph contracts, validation, compilation, deterministic
serialization, and CSS custom-property export. It does not load Material 3, Texel, browser canvas, image extraction, or
conversion engines. Optional capabilities live in adapter packages such as `@scheme-tokens/material3`.
