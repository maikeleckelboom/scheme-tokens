# Getting started

Install the package:

```sh
pnpm add scheme-tokens
```

Use an ESM project with Node.js 24 or newer, or a browser build.

## Define a graph

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    background: "#ffffff",
    foreground: "#111111",
  },
});

const scheme = orThrow(compileTokenGraph(graph));
const stylesheet = orThrow(exportCssVars(scheme)).css;
```

`defineTokenGraph()` creates the graph. `compileTokenGraph()` resolves its values, and
`exportCssVars()` produces the stylesheet:

```css
:where(:root) {
  --background: #ffffff;
  --foreground: #111111;
}
```

Save `stylesheet` as a CSS file or assign it to a style element's `textContent`.

## Use the variables

```css
body {
  background: var(--background);
  color: var(--foreground);
}
```

The graph uses a single `base` mode and public visibility by default. `orThrow()` stops the
operation if compilation or export fails. For recoverable failures, see
[error handling](../reference/diagnostics.md).

Continue with [Define tokens](./define-tokens.md) to add references, modes, and layers, or
[Export CSS variables](./export-css-variables.md) to configure theme activation.
