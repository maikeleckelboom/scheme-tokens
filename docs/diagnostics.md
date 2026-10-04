# Diagnostics

Every recoverable public failure is `{ ok: false, issues }` with a non-empty tuple. Success is `{ ok: true, value }`. `TokenGraphIssue`, `CompileTokenGraphIssue`, `ParseCompiledSchemeIssue`, and `ExportCssVarsIssue` are discriminated unions: narrowing `code` exposes the fields guaranteed by every emitter of that variant. All have `code` and `message`; JSON Pointer `path` is required only where listed below. The general-purpose `Issue` remains available with optional `path`.

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

`inconsistent-layer-modes` describes conflicting mode maps inside one layer. Token keys are considered in code-unit order. An inconsistent layer reports exactly its first conflicting map, with:

- `layerId` and conflicting `key`;
- `path` to the conflicting map and `firstPath` to the first map;
- `modes` for the first map and `layerModes` for the conflicting map, both code-unit sorted.

Persisted paths include `/value`; shorthand helper paths identify the authored location. `layer-mode-mismatch` now exclusively describes a consistent layer that differs from the graph: `/layers/<index>`, `layerId`, graph `modes` in authored order, and sorted `layerModes`. It has no conflicting token or first-map pointer. Neither case emits implied per-token missing/unknown mode issues. Already-inconsistent layers are not compared against the graph.

## Compile-time rejections

For literal input, TypeScript rejects direct graph reference typos, incomplete or foreign mode maps, invalid visibility, unknown metadata, invalid mode names, disagreeing layer maps, and finite layer/graph mode mismatches. Reusable layers may reference another layer or graph-local tokens; their targets remain checked at compilation. The bounded static prototype was rejected for composition-site errors and unnameable emitted types (ADR 0018). Compiler errors may name the internal diagnostic markers `UnknownTokenProperty`, `UnknownMode`, `InvalidModeName`, and `LayerModeMismatch`. Runtime checks still apply to every input, including dynamic and parsed data.

## Other boundaries

Graph/parser codes include `invalid-object`, `unknown-property`, `missing-property`, `invalid-token-definition`, `invalid-mode-key`, `missing-mode-value`, and `unknown-mode-value`. Strict compiled metadata uses `invalid-declarations`, `invalid-origin`, and `invalid-expression` for malformed D6 records.

Compiled v1 input returns `invalid-format-version` and asks the consumer to recompile from its source graph. V2 non-string schema hints use `invalid-schema-uri`; any string hint is accepted without interpretation. Raw v1 input retains historical hint validation before upgrade drops the hint.

Compilation adds selection issues such as `empty-selection`, `duplicate-selection-key`, and `unknown-selection-key`. Selection arrays use `/selection` and `/selection/<index>` pointers.

## Guaranteed payloads

This audit follows the emitters in source/compiled validation, expression resolution, compile options, and CSS options/names/values. Every row is a separate variant per code, even where payloads coincide. Listed fields are required in addition to `code` and `message`; other context is not assumed.

| Codes                                                                                                               | Required fields                                              | Conditional context / reason                                                        |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `invalid-object`                                                                                                    | none                                                         | Top-level object failures may have no path.                                         |
| `unknown-property`, `missing-property`                                                                              | `path`                                                       | `key` only where the validator knows a token key.                                   |
| `invalid-artifact-kind`, `invalid-format-version`, `invalid-schema-uri`, `invalid-json-value`, `empty-modes`        | `path`                                                       | Each identifies a field or collection.                                              |
| `invalid-mode-key`                                                                                                  | `path`                                                       | `mode` only when available as a string.                                             |
| `duplicate-mode-key`, `default-mode-not-found`, `missing-mode-value`, `unknown-mode-value`                          | `path`, `mode`                                               | The mode has been identified before emission.                                       |
| `invalid-token-key`                                                                                                 | `path`, `key`                                                | Enumerated object keys are strings.                                                 |
| `invalid-visibility`, `invalid-token-definition`, `invalid-description`, `invalid-deprecated`, `invalid-extensions` | `path`                                                       | Shared source/compiled validators identify the invalid field.                       |
| `invalid-default-visibility`, `missing-token-value`                                                                 | `path`                                                       | Source-only fields.                                                                 |
| `invalid-layer-id`                                                                                                  | `path`                                                       | `layerId` only for a string input.                                                  |
| `duplicate-layer-id`                                                                                                | `path`, `layerId`, `firstPath`                               | Both declaration locations are known.                                               |
| `inconsistent-layer-modes`                                                                                          | `path`, `key`, `layerId`, `firstPath`, `modes`, `layerModes` | Conflicting maps in one layer.                                                      |
| `layer-mode-mismatch`                                                                                               | `path`, `layerId`, `modes`, `layerModes`                     | Complete layer versus graph envelope.                                               |
| `invalid-token-value` (source/compiler)                                                                             | none                                                         | Standalone trusted concat construction may have no path.                            |
| `invalid-reference`                                                                                                 | none                                                         | Standalone reference construction may have no path; `mode` is conditional.          |
| `unknown-reference`, `resolved-value-too-long`                                                                      | `path`, `key`, `mode`                                        | Resolver knows the failing occurrence.                                              |
| `reference-cycle`                                                                                                   | `path`, `key`, `mode`, `cycle`                               | Every cycle emission constructs its canonical cycle.                                |
| `invalid-compile-options`, `no-selected-tokens`                                                                     | none                                                         | Failures may concern the operation as a whole.                                      |
| `invalid-selection`, `empty-selection`                                                                              | `path`                                                       | Points to the selection.                                                            |
| `invalid-selection-key`                                                                                             | `path`                                                       | `key` only for a string element.                                                    |
| `duplicate-selection-key`, `unknown-selection-key`                                                                  | `path`, `key`                                                | Element is already a valid string key.                                              |
| `invalid-token-value` (compiled parser/CSS)                                                                         | `path`, `mode`                                               | Parser is validating a compiled mode value.                                         |
| `invalid-origin`, `invalid-declarations`, `invalid-expression`                                                      | `path`                                                       | Compiled metadata location is known.                                                |
| `invalid-css-options`                                                                                               | none                                                         | `option` absent for a non-object options argument; nested names use `activation.*`. |
| `invalid-css-prefix`, `invalid-attribute`, `invalid-cascade-layer`                                                  | none                                                         | The value may be non-string.                                                        |
| `invalid-root`                                                                                                      | none                                                         | `selector` only for a string input.                                                 |
| `invalid-css-variable`                                                                                              | `key`                                                        | `property` only if the callback returned a string.                                  |
| `duplicate-css-variable`                                                                                            | `key`, `firstKey`, `property`                                | Name table records both tokens and the shared property.                             |
| `invalid-css-value`                                                                                                 | `path`, `key`, `mode`                                        | Complete projected declaration has a known source location.                         |
| `invalid-selector`                                                                                                  | `tier: "selector"`, `mode`                                   | `index` for list entries; `selector` if string.                                     |
| `invalid-media`                                                                                                     | `tier: "media" \| "selector"`, `mode`                        | `index` for list entries; `media` if string.                                        |
| `invalid-selector-condition`                                                                                        | `tier: "selector"`, `mode`                                   | `index` only for a list entry, not a singleton object or malformed whole list.      |
| `unknown-condition-mode`                                                                                            | `tier: "media" \| "selector"`, `mode`                        | Both maps enumerate a known string key.                                             |

```ts
import type { CompileTokenGraphIssue, ExportCssVarsIssue } from "scheme-tokens";

function cyclePath(issue: CompileTokenGraphIssue): string | undefined {
  if (issue.code === "reference-cycle") {
    return `${issue.path}: ${issue.cycle.join(" -> ")}`;
  }
  return undefined;
}
function collision(issue: ExportCssVarsIssue): string | undefined {
  if (issue.code === "duplicate-css-variable") {
    return `${issue.firstKey} and ${issue.key} both emit ${issue.property}`;
  }
  return undefined;
}
```

## CSS export

`exportCssVars()` first returns the compiled-scheme parser's issues unchanged. Otherwise it collects every option failure, in code-unit order of the option name and then of the mode. When the options are valid, it collects every variable-name failure in canonical token-key order, then every unsafe value in token-key and authored mode order, and returns them together.

| Code                         | Cause and structured context                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `invalid-css-options`        | Options or nested activation maps are not plain data; unknown options; invalid `format`, `references`, or `variableName`. `option` names the field when available. |
| `invalid-css-prefix`         | `prefix` is not a lower-kebab single segment.                                                                                                                      |
| `invalid-root`               | `root` is outside the bounded selector grammar; `selector` when it is a string.                                                                                    |
| `invalid-attribute`          | Attribute activation is not a lower-kebab `data-*` name or a strict `{ name, includeHost? }` object with a boolean flag.                                           |
| `invalid-cascade-layer`      | `cascadeLayer` is outside the bounded layer-name grammar.                                                                                                          |
| `unknown-condition-mode`     | `activation.media` (`tier: "media"`) or `activation.selectors` (`tier: "selector"`) names an unknown `mode`.                                                       |
| `invalid-media`              | A media condition is outside the bounded grammar; `tier`, `mode`, `index` for a list, `media` if a string.                                                         |
| `invalid-selector`           | A custom selector is outside the bounded selector grammar; `tier`, `mode`, `index` for a list, `selector` if a string.                                             |
| `invalid-selector-condition` | A selector entry is not a string, one `{ selector, media? }` object, or a non-empty list of condition objects; `tier`, `mode`, and `index` only for list entries.  |
| `invalid-css-variable`       | `variableName` threw or returned an unsafe name; `key`, and `property` when the result was a string.                                                               |
| `duplicate-css-variable`     | Two exported tokens share a variable; `firstKey` is first in code-unit order, `key` is the later key, `property` the variable.                                     |
| `invalid-css-value`          | An emitted value could escape its declaration; `key`, `mode`, and `path` into the compiled scheme. Reported once per value.                                        |

Callback failures are contained. Only emitted names can collide, and only complete emitted declaration values are safety-checked, once per key/mode. Omitted tokens and modes without any block do not undergo CSS safety checks; selected internal tokens do. Structural parsing still covers the entire artifact.

Omitted, explicit `undefined`, and `"resolved"` reference output preserve `invalid-css-value` paths at `/tokens/<key>/<mode>`. In `"var"` output, values taken directly from that field, including a pure reference's literal inlining for an omitted target, keep that path. Unsafe retained concat instead points to its complete expression at `/metadataByToken/<key>/expressionByMode/<mode>`, with `key` and `mode`. A fragment is not blamed for being incomplete on its own: balanced `"calc("`, a projected reference, and `")"` are checked together. Unused resolved alias/concat values and unused retained fallback strings are not checked. An emitted target's standalone declaration still is.

Invalid `references` values use `invalid-css-options` with `option: "references"` and collect with independent option failures. Naming failures and collisions do not stop independently discoverable projected-value failures or silently force literal inlining; unsafe names are not inserted into diagnostic values. Any naming issue prevents returned CSS.

The compiled parser validates retained-expression structure, not consistency with resolved tokens or acyclicity of edited references. Benign resolved values therefore do not exempt unsafe retained concat from projection safety checks. CSS safety does not interpret token domains, validate arbitrary CSS semantics, restrict source serialization, or HTML-escape returned CSS. Use DOM stylesheet-text assignment for untrusted strings containing `</style>`; the public API reference details this boundary.
