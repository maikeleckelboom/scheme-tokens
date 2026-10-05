# Export CSS variables

Compile a graph, then pass the scheme to `exportCssVars()`:

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const graph = defineTokenGraph({ tokens: { "surface.canvas": "#ffffff" } });
const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  const exported = exportCssVars(compiled.value, { prefix: "app" });
  if (exported.ok) {
    const stylesheet = exported.value.css;
    const backgroundProperty = exported.value.variableByToken["surface.canvas"];
  }
}
```

```css
:where(:root) {
  --app-surface-canvas: #ffffff;
}
```

The successful result's `value` contains `css`, `blocks`, and `variableByToken`. Names join the
prefix and token-key segments with hyphens. See [Diagnostics](../reference/diagnostics.md) for
structured failures.

## Use theme activation

Combine a system preference with an explicit theme choice:

<!-- example: css-activation -->

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: { background: { light: "#ffffff", dark: "#111111" } },
});
const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    activation: {
      media: { dark: "(prefers-color-scheme: dark)" },
      attribute: "data-theme",
    },
  });
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

Light values apply at `:root`; the media condition activates dark values there. A
`data-theme="light"` or `data-theme="dark"` marker overrides that preference for its subtree,
including nested sections. A value such as `system` matches neither mode.

Omitting `activation.attribute` emits no attribute markers. For a Shadow DOM host, use
`attribute: { name: "data-theme", includeHost: true }`. Set `activation.root: ":host"` when the
default and media blocks should target the host too.

## Activate with selectors

For the same compiled graph, class-based themes use `activation.selectors`:

<!-- example: css-activation -->

```ts
if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    activation: { selectors: { light: ".light", dark: ".dark" } },
  });
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

Generated blocks follow this order: default, media, attribute, selector. Within each tier, modes
follow the graph's order. All generated selectors use `:where()` with zero specificity, so
the later block wins when several match the same element.

For conditions that combine attributes and media, see
[Application theme coordinates](./application-theme-coordinates.md). The
[activation reference](../reference/css.md#activation) lists all accepted condition shapes.

## Keep CSS references live

Resolved strings are the default. Set `references: "var"` to emit links between selected tokens:

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  exportCssVars,
  tokenConcat,
  tokenRef,
} from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    spacing: "20px",
    extra: { value: "3px", visibility: "internal" },
    gap: tokenRef("spacing"),
    width: tokenConcat`calc(${tokenRef("spacing")} + ${tokenRef("extra")})`,
  },
});
const compiled = compileTokenGraph(graph);
if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    references: "var",
    prefix: "app",
  });
  if (exported.ok) {
    console.log(exported.value.css);
  }
}
```

```css
:where(:root) {
  --app-gap: var(--app-spacing);
  --app-spacing: 20px;
  --app-width: calc(var(--app-spacing) + 3px);
}
```

`spacing` is emitted, so its references stay live. `extra` is internal and omitted, so its value
is inlined. The exporter links direct targets in the selected scheme; it does not add dependencies.

A target override affects aliases declared on the same element. On an unmarked descendant,
an inherited alias already has its ancestor's computed value: redeclare the alias there or
activate a mode block on that element.

Use resolved output for character assembly such as a number followed by `px`, or references
inside quoted CSS strings. CSS `var()` substitutes tokens rather than joining characters.
See [reference projection](../reference/css.md#reference-projection) for the exact rules.

## Let application CSS override tokens

An application selector with specificity overrides generated declarations in the same cascade
layer. `cascadeLayer: "tokens"` places the output in `@layer tokens`, where unlayered normal
declarations can override it regardless of stylesheet order.

To control browser form styling, define a `color-scheme` token and bind it wherever a mode activates:

```css
:root,
[data-theme] {
  color-scheme: var(--color-scheme);
}
```

A root-only binding inherits the root's computed value into nested themes. Match your binding
to your activation selectors.

Continue with [Tailwind CSS v4](./tailwind-css-v4.md) for a utility-class bridge, or the
[CSS reference](../reference/css.md) for naming, structured blocks, formatting, and safety rules.
