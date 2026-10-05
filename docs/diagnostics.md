# Diagnostics

Parsers, compilation, and CSS export return `{ ok: false, issues }` on failure. Each issue has
`code` and `message`, plus a JSON Pointer `path` and context where specified.

`TokenGraphIssue`, `CompileTokenGraphIssue`, `ParseCompiledSchemeIssue`, and `ExportCssVarsIssue`
are discriminated unions. Narrow by `code` to access the fields guaranteed for that issue.
The general-purpose `Issue` type has an optional `path`.

Codes, payloads, and pointer semantics are public contracts; message wording is not.

## Throwing at an application boundary

Use `orThrow()` when failure should stop the operation:

```ts
import { compileTokenGraph, defineTokenGraph, orThrow } from "scheme-tokens";

const graph = defineTokenGraph({ tokens: { background: "#ffffff" } });
const scheme = orThrow(compileTokenGraph(graph));
```

It returns the success value or throws `Error`. The message includes every issue's code, path
when present, and message; `cause` contains the original non-empty issues tuple.

Authoring helpers use the same error convention. Reference targets and cycles are checked during
compilation. Parsers return `Result` for invalid JSON-compatible input.

## References and concat

| Code                      | What to fix                                               |
| ------------------------- | --------------------------------------------------------- |
| `invalid-reference`       | Supply a valid token key in an exact reference object.    |
| `invalid-token-value`     | Use a string, reference, or flat non-empty concat.        |
| `unknown-reference`       | Define the target in the graph or one of its layers.      |
| `reference-cycle`         | Break the reference loop listed in `cycle`.               |
| `resolved-value-too-long` | Reduce concat output to at most 65,536 UTF-16 code units. |

Cycles use a canonical `cycle` array and a path to the closing reference. The same cycle is
reported once per mode. Failed dependents do not add duplicate resolution failures.

Concat paths identify original reference-part indices after normalization. V1 upgrade diagnostics
point to the original document.

## Layer mode sets

`inconsistent-layer-modes` identifies conflicting maps within one layer. It reports the first
conflict in code-unit token-key order:

- `layerId` and the conflicting `key`;
- `path` to that map and `firstPath` to the first map;
- `modes` for the first map and `layerModes` for the conflicting map, both code-unit sorted.

Persisted paths include `/value`; helper paths identify the shorthand authoring location.

`layer-mode-mismatch` identifies a consistent layer whose mode set differs from the graph.
Its path is `/layers/<index>`; `modes` retains graph order and `layerModes` is sorted.
An internally inconsistent layer reports its conflict instead of a graph mismatch.

## Parsing and selection

Malformed artifact fields use codes such as `invalid-object`, `unknown-property`,
`missing-property`, `invalid-token-definition`, and `invalid-mode-key`. Incomplete mode maps use
`missing-mode-value` or `unknown-mode-value`. Compiled metadata uses `invalid-declarations`,
`invalid-origin`, and `invalid-expression`.

Compiled v1 returns `invalid-format-version`; recompile its source graph. In v2, a non-string
schema hint returns `invalid-schema-uri`; any string is accepted. V1 hints are validated under
v1 rules before upgrade.

Selection arrays use `/selection` and `/selection/<index>` paths. Empty arrays return
`empty-selection`; duplicate and unknown keys return `duplicate-selection-key` and
`unknown-selection-key`. A valid selection yielding no tokens returns `no-selected-tokens`.

## Guaranteed payloads

Fields below are required in addition to `code` and `message`. Optional context is listed
separately. A dash means there are no additional required fields.

| Codes                                                                                                               | Required fields                                              | Optional context                                         |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| `invalid-object`                                                                                                    | —                                                            | `path`                                                   |
| `unknown-property`, `missing-property`                                                                              | `path`                                                       | `key`                                                    |
| `invalid-artifact-kind`, `invalid-format-version`, `invalid-schema-uri`, `invalid-json-value`, `empty-modes`        | `path`                                                       | —                                                        |
| `invalid-mode-key`                                                                                                  | `path`                                                       | `mode`                                                   |
| `duplicate-mode-key`, `default-mode-not-found`, `missing-mode-value`, `unknown-mode-value`                          | `path`, `mode`                                               | —                                                        |
| `invalid-token-key`                                                                                                 | `path`, `key`                                                | —                                                        |
| `invalid-visibility`, `invalid-token-definition`, `invalid-description`, `invalid-deprecated`, `invalid-extensions` | `path`                                                       | —                                                        |
| `invalid-default-visibility`, `missing-token-value`                                                                 | `path`                                                       | —                                                        |
| `invalid-layer-id`                                                                                                  | `path`                                                       | `layerId`                                                |
| `duplicate-layer-id`                                                                                                | `path`, `layerId`, `firstPath`                               | —                                                        |
| `inconsistent-layer-modes`                                                                                          | `path`, `key`, `layerId`, `firstPath`, `modes`, `layerModes` | —                                                        |
| `layer-mode-mismatch`                                                                                               | `path`, `layerId`, `modes`, `layerModes`                     | —                                                        |
| `invalid-token-value` (source/compiler)                                                                             | —                                                            | `path`                                                   |
| `invalid-reference`                                                                                                 | —                                                            | `path`, `mode`                                           |
| `unknown-reference`, `resolved-value-too-long`                                                                      | `path`, `key`, `mode`                                        | —                                                        |
| `reference-cycle`                                                                                                   | `path`, `key`, `mode`, `cycle`                               | —                                                        |
| `invalid-compile-options`, `no-selected-tokens`                                                                     | —                                                            | `path`                                                   |
| `invalid-selection`, `empty-selection`                                                                              | `path`                                                       | —                                                        |
| `invalid-selection-key`                                                                                             | `path`                                                       | `key`                                                    |
| `duplicate-selection-key`, `unknown-selection-key`                                                                  | `path`, `key`                                                | —                                                        |
| `invalid-token-value` (compiled parser/CSS)                                                                         | `path`, `mode`                                               | —                                                        |
| `invalid-origin`, `invalid-declarations`, `invalid-expression`                                                      | `path`                                                       | —                                                        |
| `invalid-css-options`                                                                                               | —                                                            | `path`, `option`                                         |
| `invalid-css-prefix`, `invalid-attribute`, `invalid-cascade-layer`                                                  | —                                                            | `path`                                                   |
| `invalid-root`                                                                                                      | —                                                            | `path`, `selector`                                       |
| `invalid-css-variable`                                                                                              | `key`                                                        | `path`, `property`                                       |
| `duplicate-css-variable`                                                                                            | `key`, `firstKey`, `property`                                | `path`                                                   |
| `invalid-css-value`                                                                                                 | `path`, `key`, `mode`                                        | —                                                        |
| `invalid-selector`                                                                                                  | `tier: "selector"`, `mode`                                   | `path`, `index` for list entries; `selector` if a string |
| `invalid-media`                                                                                                     | `tier: "media" \| "selector"`, `mode`                        | `path`, `index` for list entries; `media` if a string    |
| `invalid-selector-condition`                                                                                        | `tier: "selector"`, `mode`                                   | `path`, `index` only for list entries                    |
| `unknown-condition-mode`                                                                                            | `tier: "media" \| "selector"`, `mode`                        | `path`                                                   |

```ts
import type { CompileTokenGraphIssue, ExportCssVarsIssue } from "scheme-tokens";

function describeCycle(issue: CompileTokenGraphIssue): string | undefined {
  if (issue.code === "reference-cycle") {
    return `${issue.path}: ${issue.cycle.join(" -> ")}`;
  }
  return undefined;
}

function describeCollision(issue: ExportCssVarsIssue): string | undefined {
  if (issue.code === "duplicate-css-variable") {
    return `${issue.firstKey} and ${issue.key} both emit ${issue.property}`;
  }
  return undefined;
}
```

## CSS export

The exporter returns compiled-parser issues unchanged if the artifact is invalid. Otherwise it
collects option issues in code-unit option-name and mode order. With valid options, name issues
follow token-key order, then unsafe values follow token-key and authored mode order.

| Code                         | What to fix                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `invalid-css-options`        | Supply plain options with supported fields and values. `option` identifies the field when available. |
| `invalid-css-prefix`         | Use one lower-kebab prefix segment.                                                                  |
| `invalid-root`               | Use a root selector in the supported grammar.                                                        |
| `invalid-attribute`          | Use a lower-kebab `data-*` name or `{ name, includeHost? }` with a boolean flag.                     |
| `invalid-cascade-layer`      | Use a supported dot-separated layer name.                                                            |
| `unknown-condition-mode`     | Use a mode present in the compiled scheme.                                                           |
| `invalid-media`              | Use a media condition in the supported grammar.                                                      |
| `invalid-selector`           | Use a custom selector in the supported grammar.                                                      |
| `invalid-selector-condition` | Supply a string, one condition object, or a non-empty list of condition objects.                     |
| `invalid-css-variable`       | Return a safe name from `variableName` and avoid throwing.                                           |
| `duplicate-css-variable`     | Give the two reported keys distinct variable names.                                                  |
| `invalid-css-value`          | Supply a value safe within a CSS declaration.                                                        |

Values are checked once per emitted key/mode. Resolved values and direct inlining use
`/tokens/<key>/<mode>`; unsafe retained concat uses
`/metadataByToken/<key>/expressionByMode/<mode>`. Complete projected values are checked,
rather than isolated fragments or unused resolved/fallback strings.

Invalid `references` uses `invalid-css-options` with `option: "references"`. Naming failures
and independent unsafe values are reported together. See the
[CSS reference](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs-site/reference/css.md#safe-emission)
for projection safety and supported grammars.

## TypeScript diagnostics

Helpers also reject invalid literal authoring during type checking. Reusable layer targets are
checked at compilation because another layer or the graph may supply them. See
[TypeScript access](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/docs-site/guide/typescript-access.md#understand-authoring-errors)
for compiler diagnostic markers and inference.
