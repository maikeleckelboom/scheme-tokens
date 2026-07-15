# Diagnostics

Recoverable failures contain a deterministic non-empty issue tuple.

```ts twoslash
import { compileTokenGraph, defineTokens } from "scheme-tokens";

const compiled = compileTokenGraph(
  defineTokens({
    background: "#ffffff",
  }),
);

if (compiled.ok) {
  compiled.value.tokens.background?.base;
} else {
  compiled.issues;
}
```

Every issue has a stable `code`, a human-readable `message`, and a JSON Pointer `path` when a specific input location exists. Additional fields provide machine-readable token keys, modes, layer IDs, first paths, cycles, selectors, or property names.

Issue codes and path semantics are public contracts. Message wording is not.

Every success uses `{ ok: true, value }`, including graph, layer, and compiled parsing, compilation, and CSS export. There are no operation-specific success fields.

CSS emission reports `invalid-css-value` for declaration-unsafe token strings. Compilation and serialization still accept arbitrary string values; the CSS diagnostic belongs to the code-emission boundary.
