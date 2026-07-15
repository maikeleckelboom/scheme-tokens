# Diagnostics

Every recoverable public failure uses the same result convention:

```ts
type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [Problem, ...Problem[]] };
```

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

Each issue has:

- `code`: a stable string identifier;
- `message`: a human-readable explanation;
- `path`: a JSON Pointer when a specific input location exists;
- optional structured fields such as `key`, `mode`, `layerId`, `firstPath`, `cycle`, `property`, or `selector`.

Issue objects are deterministic and JSON-safe. Diagnostic construction does not call user-defined coercion methods on unknown input.

## Contract rules

- `Issue.code` values are contractual.
- JSON Pointer path semantics are contractual.
- Human-readable message wording is not contractual.
- A failure always contains at least one issue.
- A success always contains exactly its payload under `value`.
- Issue-code unions must represent every code an operation can emit.

Common graph and parser codes include `invalid-object`, `unknown-property`, `missing-property`, `invalid-token-value`, `invalid-reference`, `unknown-reference`, and `reference-cycle`.

Compilation adds selection diagnostics such as `empty-selection`, `duplicate-selection-key`, and `unknown-selection-key`. CSS projection adds option, prefix, selector, variable-name, collision, and `invalid-css-value` diagnostics. The advanced `variableName` callback is contained: thrown exceptions and invalid or duplicate names become issues. Declaration-unsafe token strings are rejected at CSS emission; compilation and serialization continue to accept arbitrary strings.
