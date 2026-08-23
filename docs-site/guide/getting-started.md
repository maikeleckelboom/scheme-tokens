# Getting Started

Install the dependency-light root package.

```sh
pnpm add scheme-tokens
```

Define string-valued tokens, compile an exact public contract, then export CSS custom properties. The
example uses the application-local [`orThrow()` helper](../reference/diagnostics.md#application-local-orthrow)
for boundaries where a failure should stop the operation. It is not a package export.

```ts twoslash
// ---cut-start---
import type { Issue, Result } from "scheme-tokens";
declare function orThrow<Value, Problem extends Issue>(result: Result<Value, Problem>): Value;
// ---cut-end---
import { compileTokenGraph, defineTokens, exportCssVars } from "scheme-tokens";

const publicKeys = ["background", "foreground"] as const;

export function createStylesheet(): string {
  const graph = defineTokens({
    background: "#ffffff",
    foreground: "#111111",
  });

  const scheme = orThrow(
    compileTokenGraph(graph, {
      selection: { keys: publicKeys },
    }),
  );
  const cssVars = orThrow(exportCssVars(scheme));

  return cssVars.css;
}
```

Without mode options, `defineTokens()` creates the single `base` mode.

`compileTokenGraph(graph)` uses public selection by default. Because visibility is resolved from runtime
data, that result is conservatively partial and keyed access correctly requires optional handling. An
exact literal tuple such as `publicKeys` is validated at runtime, then produces a complete record where
`scheme.tokens.background.base` is definite. This is a choice between two accurate contracts, not a
workaround for incorrect typing.

Continue with [Define Tokens](./define-tokens.md) for explicit modes, references, metadata, visibility,
and layers.
