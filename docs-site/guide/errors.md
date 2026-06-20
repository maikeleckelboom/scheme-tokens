# Errors

Recoverable package failures return `Result`.

```ts
import type { Issue, Result } from "scheme-tokens";

export function assertOk<Value, I extends Issue>(result: Result<Value, I>): Value {
  if (!result.ok) {
    throw new Error(JSON.stringify(result.issues, null, 2));
  }
  return result.value;
}
```

Read `issues` when you want to present diagnostics instead of throwing:

```ts
import { parseColor } from "scheme-tokens";

const parsed = parseColor("red");
let firstCode: string | undefined;
let firstPath: string | undefined;

if (!parsed.ok) {
  firstCode = parsed.issues[0].code;
  firstPath = parsed.issues[0].path;
}

export { firstCode, firstPath };
```

`"red"` is an unsupported color string in 0.1.0. Use supported concrete CSS color syntax such as hex, `rgb()`, `hsl()`,
OKLCH, or `color(display-p3 ...)`.

## Invalid Reference Target

Strict persisted artifacts reject invalid reference targets with a `Result`.

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  kind: "scheme-tokens/color-token-graph",
  formatVersion: 1,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: {
    primary: {
      value: { ref: "Brand.Primary" },
    },
  },
});

const referenceIssue = parsed.ok ? undefined : parsed.issues[0];
export { referenceIssue };
```

Core token keys are dot-separated lower-kebab segments, so `Brand.Primary` is invalid.

## Missing Reference

Well-formed references still need an existing target.

```ts
import { compileTokenGraph, defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  semanticTokens: {
    primary: { value: tokenRef("brand.primary") },
  },
});

const compiled = compileTokenGraph(graph);
const missingReference = compiled.ok
  ? undefined
  : compiled.issues.find((issue) => issue.code === "unknown-reference");

export { missingReference };
```

## Duplicate CSS Custom Property

Custom CSS custom-property naming must produce unique CSS custom properties.

```ts
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const graph = defineTokens({
  background: "#ffffff",
  foreground: "#111111",
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value, {
  variableName: () => "--app-color",
});

const duplicateCustomProperty = cssExport.ok
  ? undefined
  : cssExport.issues.find((issue) => issue.code === "duplicate-css-variable");

export { duplicateCustomProperty };
```
