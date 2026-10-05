# API reference

## Runtime exports

| Export                    | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `defineTokenGraph`        | Author and normalize a graph.                      |
| `defineTokenLayer`        | Author and normalize a reusable layer.             |
| `tokenRef`                | Create a token reference.                          |
| `tokenConcat`             | Combine text and references in a tagged template.  |
| `orThrow`                 | Return the value or throw an Error.                |
| `parseTokenGraph`         | Validate a persisted graph.                        |
| `parseTokenLayer`         | Validate a persisted layer.                        |
| `parseCompiledScheme`     | Validate a compiled artifact.                      |
| `compileTokenGraph`       | Compose, resolve, and select tokens.               |
| `exportCssVars`           | Export a compiled scheme as CSS custom properties. |
| `serializeTokenGraph`     | Serialize a graph to JSON.                         |
| `serializeTokenLayer`     | Serialize a layer to JSON.                         |
| `serializeCompiledScheme` | Serialize a compiled scheme to JSON.               |

These are the root runtime exports. Material generation is provided by
[`@scheme-tokens/material3`](./material3.md).

## Results and errors

Parsers, compilation, and CSS export return `Result`:

```ts
type Result<Value, Problem> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly issues: readonly [Problem, ...Problem[]] };
```

```ts
import { compileTokenGraph, defineTokenGraph, exportCssVars } from "scheme-tokens";

const compiled = compileTokenGraph(defineTokenGraph({ tokens: { background: "#ffffff" } }));

if (compiled.ok) {
  const exported = exportCssVars(compiled.value);
  if (exported.ok) {
    console.log(exported.value.css);
  } else {
    console.error(exported.issues);
  }
} else {
  console.error(compiled.issues);
}
```

`orThrow()` returns the value or throws `Error`. Its message includes every issue's code, path
when present, and message; `cause` is the original issues tuple. Authoring helpers throw using
the same convention. Serializers return strings from accepted artifacts.

See [Diagnostics](./diagnostics.md) for issue codes, paths, and payloads.

## Authoring

`defineTokenGraph()` accepts these options:

| Field               | Requirement and default                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `tokens`            | Token definitions; omission becomes `{}`.                                  |
| `modes`             | A non-empty list of unique mode names; defaults to `["base"]`.             |
| `defaultMode`       | Required when `modes` is supplied; otherwise `"base"`. Must be in `modes`. |
| `defaultVisibility` | `"public"` or `"internal"`; defaults to `"public"`.                        |
| `layers`            | Layers in composition order.                                               |

A definition is an expression, a mode map, or an expanded object:

```ts
import { defineTokenGraph, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  modes: ["light", "dark"],
  defaultMode: "light",
  tokens: {
    source: "#6750a4",
    primary: tokenRef("source"),
    background: { light: "#ffffff", dark: "#111111" },
    foreground: {
      value: { light: "#111111", dark: "#ffffff" },
      description: "Text on the page background",
    },
  },
});
```

Expanded definitions require `value` and accept:

| Metadata      | Type                                 |
| ------------- | ------------------------------------ |
| `visibility`  | `"public" \| "internal"`             |
| `description` | `string`                             |
| `deprecated`  | `boolean \| string`                  |
| `extensions`  | A string-keyed record of JSON values |

Put metadata beside `value`, rather than beside mode names. A direct expression applies to every
mode; a mode map must contain exactly the graph's modes.

Token keys are dot-separated lower-kebab paths. The first segment starts with a lowercase letter;
later segments may start with digits, as in `brand.600`. Mode names are single lower-kebab
identifiers. The names `ref`, `value`, `visibility`, `description`, `deprecated`, and
`extensions` are reserved. Mode order is preserved independently of `defaultMode`.

Helpers normalize, validate, and copy accepted input. Graph reference targets and cycles are
checked when compiling the composed graph. Use [parsers](#parsers) for untrusted input.

## Expressions

Bare strings are literal. References use `tokenRef("token.key")` in TypeScript and exact
`{ ref: "token.key" }` objects in artifacts.

```ts
import { defineTokenGraph, tokenConcat, tokenRef } from "scheme-tokens";

const graph = defineTokenGraph({
  tokens: {
    primary: "#6750a4",
    ring: tokenConcat`0 0 0 3px ${tokenRef("primary")}`,
  },
});
```

`tokenConcat` accepts reference-only substitutions. Its wire form is a flat
`{ concat: [string | { ref: string }, ...] }` expression. Normalization merges adjacent literals,
drops empty literals, reduces literal-only content to a string, and reduces a lone reference to
`{ ref }`. An empty tagged template becomes `""`; empty concat arrays and nested concat
expressions are rejected.

Resolved concat values are limited to 65,536 UTF-16 code units. Larger results return
`resolved-value-too-long`. Literal values and pure references have no corresponding length limit.

`concat` is also a valid mode name. Shape distinguishes it from an expression:

| Shape                                                 | Interpretation                          |
| ----------------------------------------------------- | --------------------------------------- |
| `{ concat: ["text", { ref: "source" }] }`             | Concat expression                       |
| `{ concat: "text" }`                                  | Mode map                                |
| `{ concat: { ref: "source" } }`                       | Mode map                                |
| `{ concat: { concat: ["text", { ref: "source" }] } }` | Mode map containing a concat expression |
| `{ concat: [] }`                                      | Invalid concat expression               |

## Layers and visibility

`defineTokenLayer()` takes a unique lower-kebab `id`, required `tokens`, and optional
`defaultVisibility` (default `"public"`). The graph defines the modes and their default.
Direct layer expressions apply to every graph mode. All mode maps within a layer must share
one set, which must match the graph's set when composed; map order is irrelevant.

Conflicting maps inside a layer use `inconsistent-layer-modes`. A consistent layer that differs
from the graph uses `layer-mode-mismatch`. Each invalid layer reports one such issue.

Layers compose in array order, then graph tokens compose last. The winning declaration supplies
the value, description, deprecation, and extensions. Descriptive metadata is replaced as a whole.

Visibility follows these rules:

1. An explicit `visibility` replaces the previous visibility.
2. An override that omits visibility keeps the previous visibility.
3. A new key that omits visibility uses its introducing graph or layer's `defaultVisibility`.

Public tokens can reference internal tokens. Resolution uses the complete composed graph before
selection.

## Compilation and selection

`compileTokenGraph(graph, options?)` accepts one option, `selection`:

| Selection             | Output                               |
| --------------------- | ------------------------------------ |
| Omitted or `"public"` | Public tokens                        |
| `"all"`               | Every composed token                 |
| A key array           | Those keys, regardless of visibility |

Explicit arrays reject empty selections, duplicate keys, malformed keys, and unknown keys.
A selection that produces no tokens returns `no-selected-tokens`. All composed tokens are
resolved before output selection, so errors in omitted tokens still fail compilation.

Output keys use code-unit order, independent of selection-array order. The scheme retains the
graph's mode order and `defaultMode`. Resolved values are read as `scheme.tokens[key][mode]`.

## Compiled metadata

`metadataByToken[key]` contains:

| Field                                     | Contents                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| `visibility`                              | Effective visibility after composition                   |
| `declarations`                            | Non-empty declaration list in composition order          |
| `expressionByMode`                        | Retained expressions for non-literal modes, when present |
| `description`, `deprecated`, `extensions` | Metadata from the winning declaration                    |

Each declaration has `origin: { kind: "graph" }` or `origin: { kind: "layer", id }`.
`declaredVisibility` is present only when that declaration specified visibility. The last
declaration wins.

Retained pure references use `{ ref }`. Retained concat parts are strings or `{ ref, value }`,
where `value` is that part's resolved string for the mode. Literal modes have no retained
expression entry. This data supports [CSS reference projection](./css.md#reference-projection).

## Parsers

| Parser                                | Accepted input and checks                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `parseTokenGraph(input: unknown)`     | Graph structure, mode coverage, composition, reference targets, and cycles                     |
| `parseTokenLayer(input: unknown)`     | Layer structure and agreement among its mode maps; reference targets are checked when composed |
| `parseCompiledScheme(input: unknown)` | Compiled values and metadata structure                                                         |

Parsers return copies of accepted artifacts and `Result` issues for invalid JSON-compatible data.
They reject unknown properties and unsupported versions. They accept the expanded artifact grammar,
rather than authoring shorthand.

```ts
import { compileTokenGraph, parseTokenGraph } from "scheme-tokens";

declare const input: unknown;
const parsed = parseTokenGraph(input);

if (parsed.ok) {
  const compiled = compileTokenGraph(parsed.value);
}
```

Compiled parsing checks retained-expression structure. It does not check that edited expressions
agree with resolved values or form an acyclic graph. Recompile source when changing token relationships.

## Artifacts and schemas

Writers emit `formatVersion: 2`. Artifacts have these required fields, plus optional `$schema`:

| Artifact        | `kind`                          | Other required fields                                 |
| --------------- | ------------------------------- | ----------------------------------------------------- |
| Graph           | `scheme-tokens/token-graph`     | `modes`, `defaultMode`, `defaultVisibility`, `tokens` |
| Layer           | `scheme-tokens/token-layer`     | `id`, `defaultVisibility`, `tokens`                   |
| Compiled scheme | `scheme-tokens/compiled-scheme` | `modes`, `defaultMode`, `tokens`, `metadataByToken`   |

Graphs may also contain `layers`. Graph and layer token definitions always contain `value`,
holding an expression or complete mode map.

```ts
import { parseTokenGraph } from "scheme-tokens";

const parsed = parseTokenGraph({
  $schema: "https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json",
  kind: "scheme-tokens/token-graph",
  formatVersion: 2,
  modes: ["base"],
  defaultMode: "base",
  defaultVisibility: "public",
  tokens: { background: { value: "#ffffff" } },
});
```

`$schema` is an optional string preserved verbatim for editor use. Runtime format selection
uses `kind` and `formatVersion`; schema hints are neither fetched nor synthesized. Authoring
helpers reject `$schema`.

Packaged schemas are self-contained JSON Schema Draft 2020-12 files with internal fragment
references:

- `scheme-tokens/schemas/token-graph.v2.schema.json`
- `scheme-tokens/schemas/token-layer.v2.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v2.schema.json`

Their `$id` values use stable `tag:` identities, such as
`tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. Use a versioned package-CDN URL,
as above, when an editor needs a retrievable schema.

### Reading v1 source

Source parsers accept v1 graphs and layers, upgrade them to v2, and apply v2 validation. The upgrade
preserves published v1 values, effective visibility, descriptive metadata, and historical
default-first mode order. Shadowed graph declarations move into a leading synthetic layer;
visibility is restated where needed. V1 schema hints are checked under v1 rules and then dropped.
Diagnostics point to the original source document.

Compiled v1 is rejected with `invalid-format-version`. Parse and recompile its source graph.

## Serialization

`serializeTokenGraph()`, `serializeTokenLayer()`, and `serializeCompiledScheme()` return
formatted JSON with a trailing newline. They take accepted artifacts; parse unknown data first.

Record keys use code-unit order. Graph mode and layer arrays retain their order; compiled token
mode values follow the graph's mode order. Graph serialization writes layers before graph-local
tokens. Parse/serialize round trips preserve accepted artifacts.

## TypeScript

Helpers infer keys, modes, and visibility from literal input. Compilation returns complete records
when the selected key set is known, and partial records when it is uncertain. CSS export carries
that distinction into `variableByToken`.

The [TypeScript guide](../guide/typescript-access.md) owns the completeness rules, generic types,
and authoring diagnostics. The [Material reference](./material3.md#typescript) covers generated layers.

## CSS export

`exportCssVars(scheme, options?)` returns CSS, structured blocks, and `variableByToken`.
Options are `prefix`, `variableName`, `format`, `references`, `activation`, and `cascadeLayer`.

See the [CSS guide](../guide/export-css-variables.md) for examples and the
[CSS reference](./css.md) for option shapes, activation order, reference projection, and safety.

## Public types

The root exports `Result`, `Issue`, `JsonValue`, graph and expression types, compiled value and
metadata types, CSS types, and operation-specific option and issue types. The
[declaration snapshot](https://github.com/maikeleckelboom/scheme-tokens/blob/dev/api/scheme-tokens.api.d.ts)
lists the full type surface.
