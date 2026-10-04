# Getting Started

Install the dependency-light root package.

```sh
pnpm add scheme-tokens
```

Define string-valued tokens, compile an exact public contract, then export CSS custom properties. The
example uses the public [`orThrow` helper](../reference/diagnostics.md#throwing-at-an-application-boundary)
for boundaries where a failure should stop the operation. Failure causes retain the complete issue tuple.

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars, orThrow } from "scheme-tokens";

const publicKeys = ["background", "foreground"] as const;

export function createStylesheet(): string {
  const graph = defineTokenGraph({
    tokens: {
      background: "#ffffff",
      foreground: "#111111",
    },
  });

  const scheme = orThrow(
    compileTokenGraph(graph, {
      selection: publicKeys,
    }),
  );
  const cssVars = orThrow(exportCssVars(scheme));

  return cssVars.css;
}
```

Without mode options, `defineTokenGraph()` creates the single `base` mode.

`compileTokenGraph(graph)` uses public selection by default. For a literal graph TypeScript knows the
public keys, so that result is a complete record too. An exact literal tuple such as `publicKeys` states
the contract explicitly: it is validated at runtime, then `scheme.tokens.background.base` is definite even
when the public set comes from dynamic data.

Continue with [Define Tokens](./define-tokens.md) for explicit modes, references, metadata, visibility,
and layers.
