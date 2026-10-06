# Getting started

Install the package:

```sh
pnpm add scheme-tokens
```

Use an ESM project with Node.js 24 or newer, or a browser build.

## Define a graph

<!-- example: first-stylesheet -->

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    "brand.600": "#6750a4",
    background: "#ffffff",
    foreground: "#111111",
    primary: tokenRef("brand.600"),
  },
});
```

Strings are literal values; `tokenRef()` makes a reference explicit. This graph uses one `base`
mode and public visibility by default.

## Compile the graph

<!-- example: first-stylesheet -->

```ts
import { compileTokenGraph } from "scheme-tokens";

const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  console.log(compiled.value.tokens.primary.base); // "#6750a4"
}
```

Compilation resolves the graph by mode and returns a `Result`. Success contains `value`; failure
contains structured `issues`. See [Diagnostics](../reference/diagnostics.md) for error handling.

## Export CSS

Pass the successful compiled scheme to the exporter:

<!-- example: first-stylesheet -->

```ts
import { exportCssVars } from "scheme-tokens";

if (compiled.ok) {
  const exported = exportCssVars(compiled.value);
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

The successful export's `css` is the stylesheet:

```css
:where(:root) {
  --background: #ffffff;
  --brand-600: #6750a4;
  --foreground: #111111;
  --primary: #6750a4;
}
```

Save `exported.value.css` as a CSS file or assign it to a style element's `textContent` after
checking `exported.ok`.

## Use the variables

```css
body {
  background: var(--background);
  color: var(--foreground);
}

button {
  background: var(--primary);
}
```

Continue with [Define tokens](./define-tokens.md) to add modes and layers, or
[Export CSS variables](./export-css-variables.md) to configure theme activation. The
[Material/shadcn example](./material3.md#use-shadcn-names) connects a generated layer to
application semantics and [Tailwind utilities](./tailwind-css-v4.md#use-shadcn-variables).
