# Diagnostics

Recoverable public failures return issues.

```ts
const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  compiled.issues;
}
```

Each issue has:

- `code`: a stable string identifier;
- `message`: a human-readable explanation;
- `path`: a JSON Pointer when a specific input location exists;
- optional structured fields such as `key`, `mode`, `layerId`, `firstPath`, or `cycle`.

Issue objects are JSON-safe. Diagnostic construction must not call user-defined coercion methods on unknown input.

## Contract Rules

- Public issue codes are part of the API contract.
- JSON Pointer paths are part of the API contract.
- Generated issue-code unions must represent the real codes.
- Public failures use `{ ok: false, issues }`.
- Public successes use named payload fields such as `scheme`, `graph`, `layer`, `css`, `blocks`, and `variableByToken`.

## Common Codes

Graph parsing can report codes such as:

- `invalid-object`
- `unknown-property`
- `missing-property`
- `invalid-token-key`
- `invalid-token-value`
- `invalid-reference`
- `unknown-reference`
- `reference-cycle`

Compilation can report codes such as:

- `invalid-compile-options`
- `invalid-selection`
- `unknown-selection-key`
- `no-selected-tokens`

CSS export can report codes such as:

- `invalid-css-options`
- `invalid-css-prefix`
- `duplicate-css-variable`
- `invalid-scope`
- `missing-mode-selector`
