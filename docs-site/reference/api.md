# API Reference

The root API is the graph/compiler/exporter surface.

## Authoring

| API                | Use                                |
| ------------------ | ---------------------------------- |
| `defineTokens`     | Define a simple token record.      |
| `defineTokenGraph` | Define full graph-shaped input.    |
| `defineTokenLayer` | Define an ordered overlay layer.   |
| `tokenRef`         | Build an explicit token reference. |

## Compile and Build

| API                   | Use                             |
| --------------------- | ------------------------------- |
| `compileTokenGraph`   | Validate and resolve a graph.   |
| `buildScheme`         | Run source adapters and layers. |
| `createSchemeBuilder` | Reuse the same build options.   |

## Export and Serialize

| API                       | Use                                    |
| ------------------------- | -------------------------------------- |
| `exportCssVars`           | Export CSS custom properties.          |
| `serializeCompiledScheme` | Write deterministic compiled JSON.     |
| `serializeTokenGraph`     | Write deterministic strict graph JSON. |
| `serializeTokenLayer`     | Write deterministic strict layer JSON. |

## Parse Strict Artifacts

| API                   | Use                            |
| --------------------- | ------------------------------ |
| `parseCompiledScheme` | Validate loaded compiled JSON. |
| `parseTokenGraph`     | Validate loaded graph JSON.    |
| `parseTokenLayer`     | Validate loaded layer JSON.    |

## Checked Example

```ts
import {
  compileTokenGraph,
  defineTokenGraph,
  defineTokenLayer,
  defineTokens,
  exportCssVars,
  parseCompiledScheme,
  parseTokenGraph,
  parseTokenLayer,
  serializeCompiledScheme,
  serializeTokenGraph,
  serializeTokenLayer,
} from "scheme-tokens";

const simpleGraph = defineTokens({
  "brand.primary": "#6750a4",
});

const graph = defineTokenGraph({
  tokens: {
    "brand.primary": {
      value: "#6750a4",
      visibility: "internal",
    },
  },
  aliases: {
    primary: "brand.primary",
  },
});

const layer = defineTokenLayer({
  id: "brand",
  tokens: {
    primary: "#6750a4",
  },
});

const compiled = compileTokenGraph(graph);
if (!compiled.ok) {
  throw new Error(JSON.stringify(compiled.issues, null, 2));
}

const cssExport = exportCssVars(compiled.value);
if (!cssExport.ok) {
  throw new Error(JSON.stringify(cssExport.issues, null, 2));
}

const compiledJson = serializeCompiledScheme(compiled.value);
const graphJson = serializeTokenGraph(simpleGraph);
const layerJson = serializeTokenLayer(layer);
const parsedCompiled = parseCompiledScheme(JSON.parse(compiledJson));
const parsedGraph = parseTokenGraph(JSON.parse(graphJson));
const parsedLayer = parseTokenLayer(JSON.parse(layerJson));

export { cssExport, parsedCompiled, parsedGraph, parsedLayer };
```

Root has no public CSS color parsing or formatting API. Token values are strings in the root contract.
