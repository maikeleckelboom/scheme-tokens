# Export CSS Variables

`exportCssVars()` accepts a compiled scheme and returns a `Result` containing CSS, structured blocks, and a token-to-property lookup.

```ts twoslash
// ---cut-start---
import type { Issue, Result } from "scheme-tokens";
declare function orThrow<Value, Problem extends Issue>(result: Result<Value, Problem>): Value;
// ---cut-end---
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens(
  { background: { light: "#ffffff", dark: "#111111" } },
  { modes: ["light", "dark"], defaultMode: "light" },
);
const scheme = orThrow(compileTokenGraph(graph));

const cssVars = orThrow(
  exportCssVars(scheme, {
    prefix: "color",
    modeSelectors: {
      strategy: "selectors",
      selectors: {
        light: ":root",
        dark: ".dark",
      },
    },
  }),
);

const css = cssVars.css;
const blocks = cssVars.blocks;
const backgroundProperty = cssVars.variableByToken.background;
backgroundProperty?.toUpperCase();
```

`backgroundProperty` is `string | undefined` because omitted selection means runtime-filtered public output. Use optional access. An exact literal key tuple makes the lookup definite after validation; `selection: "all"` does so only for a finite authored key union. CSS exported from `parseCompiledScheme()` remains partial.

The declarative options cover:

- an optional lower-kebab prefix;
- root or explicit selector scope;
- data-attribute, class, or exact per-mode selectors;
- pretty or compact output.

Token order, mode order, selector blocks, declaration formatting, and trailing-newline behavior are deterministic.

Exact selector maps are typed to the compiled mode union. They must contain every compiled mode and cannot add an unknown mode. Selector validation intentionally accepts a bounded safe grammar rather than the complete browser selector language. Generated data-attribute and class selectors require an append-safe scope; exact per-mode selectors are the escape hatch for supported complex selectors.

Compilation and serialization preserve arbitrary token strings. CSS export is a stricter code-emission boundary: declaration-unsafe values return `invalid-css-value` instead of being written. The check does not interpret color, spacing, or any other token semantics.

## Advanced variable names

Use `variableName` only when integration requires a non-default property mapping:

```ts twoslash
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(defineTokens({ background: "#ffffff" }));

if (compiled.ok) {
  const exported = exportCssVars(compiled.value, {
    variableName({ tokenKey, defaultName }) {
      return tokenKey === "background" ? "--surface" : defaultName;
    },
  });
}
```

The callback runs in deterministic token order. A thrown exception, unsafe custom-property name, or collision becomes a structured failure issue.

For a framework bridge that keeps runtime variables application-owned, see
[Tailwind CSS v4](./tailwind-css-v4.md).
