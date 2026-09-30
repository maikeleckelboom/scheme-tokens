# Diagnostics

Every recoverable public failure is `{ ok: false, issues }` with a non-empty tuple. Success is `{ ok: true, value }`. Issues contain stable `code`, human-readable `message`, and optional JSON Pointer `path`. Structured context may include `key`, `mode`, `layerId`, `firstPath`, `cycle`, `modes`, `layerModes`, or, for CSS export, `option`, `firstKey`, `tier`, `index`, `property`, `selector`, and `media`.

Codes and pointer semantics are public contracts; message wording is not. Diagnostics are deterministic and JSON-safe, and their construction never calls untrusted coercion methods.

## Throwing at an application boundary

`orThrow()` returns the exact success value or throws `Error`. Its message includes every issue's code, path when present, and message; `error.cause` is the complete original issue tuple.

```ts
import { compileTokenGraph, defineTokenGraph, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({ tokens: { background: "#ffffff" } });
const scheme = orThrow(compileTokenGraph(graph));
scheme.tokens.background.base;
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

## Compile-time rejections

For literal input, TypeScript rejects the same authoring mistakes before runtime: reference typos, incomplete or foreign mode maps, invalid visibility, unknown metadata, invalid mode names, disagreeing layer maps, and finite layer/graph mode mismatches. Those are compiler errors, not issues, and their messages may name the diagnostic markers `UnknownTokenProperty`, `UnknownMode`, `InvalidModeName`, and `LayerModeMismatch`. The runtime checks above still apply to every input, including dynamic and parsed data that TypeScript cannot check.

## Other boundaries

Graph/parser codes include `invalid-object`, `unknown-property`, `missing-property`, `invalid-token-definition`, `invalid-mode-key`, `missing-mode-value`, and `unknown-mode-value`. Strict compiled metadata uses `invalid-declarations`, `invalid-origin`, and `invalid-expression` for malformed D6 records.

Compiled v1 input returns `invalid-format-version` and asks the consumer to recompile from its source graph. V2 non-string schema hints use `invalid-schema-uri`; any string hint is accepted without interpretation. Raw v1 input retains historical hint validation before upgrade drops the hint.

Compilation adds selection issues such as `empty-selection`, `duplicate-selection-key`, and `unknown-selection-key`.

## CSS export

`exportCssVars()` first returns the compiled-scheme parser's issues unchanged. Otherwise it collects every option failure, in code-unit order of the option name and then of the mode. When the options are valid, it collects every variable-name failure in canonical token-key order, then every unsafe value in token-key and authored mode order, and returns them together.

| Code                       | Cause and structured context                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-css-options`      | Options, `system`, or `selectors` are not plain data; an unknown option; an invalid `format`, `references`, or `variableName`. `option` names it. |
| `invalid-css-prefix`       | `prefix` is not a lower-kebab single segment.                                                                                                     |
| `invalid-root`             | `root` is outside the bounded selector grammar; `selector` when it is a string.                                                                   |
| `invalid-attribute`        | `attribute` is neither `false` nor a lower-kebab `data-*` name.                                                                                   |
| `invalid-cascade-layer`    | `cascadeLayer` is outside the bounded layer-name grammar.                                                                                         |
| `unknown-condition-mode`   | `system` (`tier: "system"`) or `selectors` (`tier: "custom"`) names a mode the scheme does not have; `mode`.                                      |
| `invalid-media`            | A system or custom media condition is outside the bounded media grammar; `tier`, `mode`, `index` for a list, `media` if a string.                 |
| `invalid-selector`         | A custom selector is outside the bounded selector grammar; `tier`, `mode`, `index` for a list, `selector` if a string.                            |
| `invalid-custom-condition` | A custom entry is not a selector or a non-empty list of `{ selector, media? }` objects; `tier`, `mode`, and `index`.                              |
| `invalid-css-variable`     | `variableName` threw or returned an unsafe name; `key`, and `property` when the result was a string.                                              |
| `duplicate-css-variable`   | Two exported tokens share a variable; `firstKey` is first in code-unit order, `key` is the later key, `property` the variable.                    |
| `invalid-css-value`        | An emitted value could escape its declaration; `key`, `mode`, and `path` into the compiled scheme. Reported once per value.                       |

Callback failures are contained. Only emitted names can collide, and only complete emitted declaration values are safety-checked, once per key/mode. Omitted tokens and modes without any block do not undergo CSS safety checks; selected internal tokens do. Structural parsing still covers the entire artifact.

Omitted, explicit `undefined`, and `"resolved"` reference output preserve `invalid-css-value` paths at `/tokens/<key>/<mode>`. In `"var"` output, values taken directly from that field, including a pure reference's literal inlining for an omitted target, keep that path. Unsafe retained concat instead points to its complete expression at `/metadataByToken/<key>/expressionByMode/<mode>`, with `key` and `mode`. A fragment is not blamed for being incomplete on its own: balanced `"calc("`, a projected reference, and `")"` are checked together. Unused resolved alias/concat values and unused retained fallback strings are not checked. An emitted target's standalone declaration still is.

Invalid `references` values use `invalid-css-options` with `option: "references"` and collect with independent option failures. Naming failures and collisions do not stop independently discoverable projected-value failures or silently force literal inlining; unsafe names are not inserted into diagnostic values. Any naming issue prevents returned CSS.

The compiled parser validates retained-expression structure, not consistency with resolved tokens or acyclicity of edited references. Benign resolved values therefore do not exempt unsafe retained concat from projection safety checks. CSS safety does not interpret token domains, validate arbitrary CSS semantics, restrict source serialization, or HTML-escape returned CSS. Use DOM stylesheet-text assignment for untrusted strings containing `</style>`; the public API reference details this boundary.
