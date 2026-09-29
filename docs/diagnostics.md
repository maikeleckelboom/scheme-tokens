# Diagnostics

Every recoverable public failure is `{ ok: false, issues }` with a non-empty tuple. Success is `{ ok: true, value }`. Issues contain stable `code`, human-readable `message`, and optional JSON Pointer `path`. Structured context may include `key`, `mode`, `layerId`, `firstPath`, `cycle`, `modes`, `layerModes`, `property`, or `selector`.

Codes and pointer semantics are public contracts; message wording is not. Diagnostics are deterministic and JSON-safe, and their construction never calls untrusted coercion methods.

## Throwing at an application boundary

`orThrow()` returns the exact success value or throws `Error`. Its message includes every issue's code, path when present, and message; `error.cause` is the complete original issue tuple.

```ts
import { compileTokenGraph, defineTokenGraph, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({ tokens: { background: "#ffffff" } });
const scheme = orThrow(compileTokenGraph(graph));
scheme.tokens.background?.base;
```

Trusted graph/layer helpers use the same structured error convention for programmer misuse. Unknown targets and cycles remain compiler diagnostics at that boundary. Parsers return `Result` rather than throwing for JSON-compatible input.

## Expressions

- Malformed references use `invalid-reference`.
- Empty, nested, or otherwise invalid concat uses `invalid-token-value`.
- Missing targets use `unknown-reference` at the reference occurrence.
- Cycles use `reference-cycle`, with a canonical `cycle` array and a pointer to the closing occurrence. The same cycle is reported once per mode.
- Concats exceeding 65,536 UTF-16 code units use `resolved-value-too-long` before allocating the oversized joined string. Failed dependents do not emit additional failures.

Concat reference pointers identify the original part index even when adjacent literals merge or the expression collapses to a lone reference. V1 upgrade diagnostics refer to the original document rather than the synthetic layer.

## Layer mode sets

`layer-mode-mismatch` describes either an inconsistent standalone layer or a layer that does not fit its graph. Token keys are considered in code-unit order. An inconsistent layer reports exactly its first conflicting map, with:

- `layerId` and conflicting `key`;
- `path` to the conflicting map and `firstPath` to the first map;
- `modes` for the first map and `layerModes` for the conflicting map, both code-unit sorted.

Persisted paths include `/value`; shorthand helper paths identify the authored location. A consistent layer that differs from the graph reports `/layers/<index>`, `layerId`, graph `modes` in authored order, and sorted `layerModes`. Neither case emits implied per-token missing/unknown mode issues. Already-inconsistent layers are not compared against the graph.

## Other boundaries

Graph/parser codes include `invalid-object`, `unknown-property`, `missing-property`, `invalid-token-definition`, `invalid-mode-key`, `missing-mode-value`, and `unknown-mode-value`. Strict compiled metadata uses `invalid-declarations`, `invalid-origin`, and `invalid-expression` for malformed D6 records.

Compiled v1 input returns `invalid-format-version` and asks the consumer to recompile from its source graph. V2 non-string schema hints use `invalid-schema-uri`; any string hint is accepted without interpretation. Raw v1 input retains historical hint validation before upgrade drops the hint.

Compilation adds selection issues such as `empty-selection`, `duplicate-selection-key`, and `unknown-selection-key`. CSS projection adds option, prefix, selector, variable-name, collision, and `invalid-css-value` diagnostics. Callback failures are contained. CSS safety checks do not interpret token domains or restrict source serialization.
