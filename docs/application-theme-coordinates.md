# Application theme coordinates

An application can track palette and light/dark preference independently. Combine those choices
into graph modes when building tokens, while keeping application state and controls in terms of
the original choices.

For example, `mono-light`, `mono-dark`, `vivid-light`, and `vivid-dark` describe two palettes
in two color schemes. Activate them using the application's `data-palette` and `data-scheme`
attributes.

## Combine two axes

Order the modes from general to specific. Selector blocks follow that order, so later matching
conditions win:

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["mono-light", "mono-dark", "vivid-light", "vivid-dark"],
  defaultMode: "mono-light",
  tokens: {
    "surface.canvas": {
      "mono-light": "#ffffff",
      "mono-dark": "#111111",
      "vivid-light": "#fffaf5",
      "vivid-dark": "#111321",
    },
  },
});
const scheme = orThrow(compileTokenGraph(graph));
const theme = orThrow(
  exportCssVars(scheme, {
    activation: {
      media: { "mono-dark": "(prefers-color-scheme: dark)" },
      selectors: {
        "mono-light": '[data-scheme="light"]',
        "mono-dark": '[data-scheme="dark"]',
        "vivid-light": '[data-palette="vivid"]',
        "vivid-dark": [
          {
            selector: '[data-palette="vivid"]:not([data-scheme="light"])',
            media: "(prefers-color-scheme: dark)",
          },
          { selector: '[data-palette="vivid"][data-scheme="dark"]' },
        ],
      },
    },
    prefix: "app",
  }),
);
```

With neither attribute, the mono palette follows the system preference. `data-palette="vivid"`
switches palettes while retaining that preference. An explicit `data-scheme="light"` or
`data-scheme="dark"` wins over it.

Put both attributes on the same theme element. The compound selectors match attributes on that
element, rather than on its ancestors. A section carrying the attributes themes its subtree.

The `:not([data-scheme="light"])` condition keeps the vivid dark fallback from overriding an
explicit light choice. Attribute generation is omitted because the selectors use the application's
two attributes directly.

## Application integration

Keep theme state, persistence, controls, and URLs in application code. The graph receives the
combined mode names; CSS activation maps them back to the chosen attributes.

If you define a `color-scheme` token, bind it on each theme element so nested themes get the
appropriate browser styling. See the
[CSS guide](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs-site/guide/export-css-variables.md#let-application-css-override-tokens).

## Examples

The [theme-coordinate example](https://github.com/maikeleckelboom/scheme-tokens/tree/dev/examples/theme-coordinates)
includes application types, internal source tokens, public aliases, and explicit selection.
The [Material example](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/examples/theme-coordinates/material.ts)
uses the same approach with generated color roles across six modes.
