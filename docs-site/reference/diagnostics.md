# Diagnostics

Recoverable failures return deterministic issue arrays.

```text
const compiled = compileTokenGraph(graph);

if (!compiled.ok) {
  compiled.issues;
}
```

Issues include a stable `code`, a `message`, and a JSON Pointer `path` when a specific input location exists.

Public successes use named payload fields:

- `compileTokenGraph(...)` returns `scheme`.
- `parseTokenGraph(...)` returns `graph`.
- `parseTokenLayer(...)` returns `layer`.
- `parseCompiledScheme(...)` returns `scheme`.
- `exportCssVars(...)` returns `css`, `blocks`, and `variableByToken`.
