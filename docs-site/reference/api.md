# API

## Runtime Exports

| Export                    | Purpose                                      |
| ------------------------- | -------------------------------------------- |
| `defineTokens`            | Define the ordinary token graph path.        |
| `defineTokenGraph`        | Define an explicit graph artifact.           |
| `defineTokenLayer`        | Define a reusable layer artifact.            |
| `tokenRef`                | Create an explicit token reference.          |
| `parseTokenGraph`         | Parse a strict token graph artifact.         |
| `parseTokenLayer`         | Parse a strict token layer artifact.         |
| `compileTokenGraph`       | Compile a graph into a `CompiledScheme`.     |
| `parseCompiledScheme`     | Parse a strict compiled scheme artifact.     |
| `serializeTokenGraph`     | Deterministically serialize a graph.         |
| `serializeTokenLayer`     | Deterministically serialize a layer.         |
| `serializeCompiledScheme` | Deterministically serialize compiled output. |
| `exportCssVars`           | Export CSS custom properties.                |

## Result Shapes

```text
const compiled = compileTokenGraph(graph);

if (compiled.ok) {
  compiled.scheme.tokens.background.base;
}

const parsed = parseTokenGraph(graph);

if (parsed.ok) {
  parsed.graph.tokens.background;
}
```

`exportCssVars()` returns direct fields on success:

```text
const cssExport = compiled.ok ? exportCssVars(compiled.scheme) : undefined;

if (cssExport?.ok) {
  cssExport.css;
  cssExport.blocks;
  cssExport.variableByToken;
}
```

## Schemas

- `scheme-tokens/schemas/token-graph.v1.schema.json`
- `scheme-tokens/schemas/token-layer.v1.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v1.schema.json`
