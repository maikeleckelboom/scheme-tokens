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

## Application-local `orThrow`

The package keeps failures explicit and does not export a throwing helper. At an application boundary
where any issue should stop the operation, a local helper can preserve the complete issue objects while
keeping the call site short:

```ts twoslash
import type { CompileTokenGraphIssue, ExportCssVarsIssue, Result } from "scheme-tokens";

type RichIssue = CompileTokenGraphIssue | ExportCssVarsIssue;

function formatIssue(issue: RichIssue): string {
  const { code, message, ...context } = issue;
  const details = Object.keys(context).length === 0 ? "" : ` ${JSON.stringify(context)}`;
  return `${code}${details}: ${message}`;
}

export function orThrow<Value, Problem extends RichIssue>(result: Result<Value, Problem>): Value {
  if (result.ok) {
    return result.value;
  }

  throw new Error(result.issues.map(formatIssue).join("\n"));
}
```

`Issue` itself contains only `code`, `message`, and optional `path`, so the formatter uses the exported
concrete issue unions instead. `CompileTokenGraphIssue` includes graph/parser issues, while
`ExportCssVarsIssue` includes compiled-parser and CSS issues. Object rest keeps every field present on
an issue in the error text, including `key`, `mode`, `layerId`, `firstPath`, `cycle`, `firstKey`,
`property`, and `selector` when available. This helper changes only application control flow; the
package still returns the original binary `Result`.

## Contract rules

- `Issue.code` values are contractual.
- JSON Pointer path semantics are contractual.
- Human-readable message wording is not contractual.
- A failure always contains at least one issue.
- A success always contains exactly its payload under `value`.
- Issue-code unions must represent every code an operation can emit.

Common graph and parser codes include `invalid-object`, `unknown-property`, `missing-property`, `invalid-token-value`, `invalid-reference`, `unknown-reference`, and `reference-cycle`.

Compilation adds selection diagnostics such as `empty-selection`, `duplicate-selection-key`, and `unknown-selection-key`. CSS projection adds option, prefix, selector, variable-name, collision, and `invalid-css-value` diagnostics. The advanced `variableName` callback is contained: thrown exceptions and invalid or duplicate names become issues. Declaration-unsafe token strings are rejected at CSS emission; compilation and serialization continue to accept arbitrary strings.
