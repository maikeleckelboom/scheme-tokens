# API

## Runtime exports

| Export                    | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `defineTokenGraph`        | Define a trusted graph with explicit options or layers.         |
| `defineTokenLayer`        | Define a trusted reusable layer.                                |
| `tokenConcat`             | Build a reference-only tagged-template concat.                  |
| `orThrow`                 | Unwrap success or throw an Error with every issue in its cause. |
| `tokenRef`                | Create an explicit reference.                                   |
| `parseTokenGraph`         | Parse an untrusted strict graph.                                |
| `parseTokenLayer`         | Parse an untrusted strict layer.                                |
| `parseCompiledScheme`     | Parse an untrusted compiled scheme.                             |
| `compileTokenGraph`       | Compile a graph with explicit selection.                        |
| `exportCssVars`           | Project a compiled scheme to CSS custom properties.             |
| `serializeTokenGraph`     | Canonically serialize a graph.                                  |
| `serializeTokenLayer`     | Canonically serialize a layer.                                  |
| `serializeCompiledScheme` | Canonically serialize compiled output.                          |

These are the complete root runtime exports.

## Result

Every fallible operation uses the same public type:

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
    exported.value.css;
    exported.value.blocks;
    exported.value.variableByToken;
  }
}
```

`orThrow()` returns the exact success value or throws `Error` with every issue code, path when present, and message. Its `cause` is the original non-empty issue tuple. Graph/layer helpers use the same convention.

## Trusted helpers

- `defineTokenGraph(input)`
- `defineTokenLayer(input)`
- `tokenRef(key)`
- `tokenConcat` tagged templates

Trusted helpers normalize and copy accepted TypeScript authoring input. They may throw for malformed keys, invalid references, contradictory mode options, or other programmer misuse.

Omitted mode options mean `base`/`base`. Explicit `modes` require `defaultMode`. Authored mode order survives independently of the default. Mode names are single lower-kebab identifiers; `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` are reserved.

Layers have stable IDs and local default visibility, but no mode envelope. Direct expressions fit every graph. All mode maps within one layer must name the same set; a non-empty set must exactly match the graph modes, ignoring order. Mismatches return one deterministic `layer-mode-mismatch` per invalid layer. The graph owns mode order and default. Layers compose in array order, then graph tokens compose last. The winner supplies value and descriptive metadata. Omitted visibility preserves prior effective visibility; explicit visibility restates it. With no explicit visibility, the default of the position that introduced the key applies.

`tokenConcat` is a tagged template with reference-only substitutions. An empty template becomes `""`; a lone reference becomes `{ ref }`. Exact `{ concat: [...] }` source expressions merge adjacent literals, drop empty literals, and collapse literal-only content. Empty arrays and nested concat are invalid. Resolved concat is limited to 65,536 UTF-16 code units before joining; arbitrary literals and pure references remain unrestricted.

`concat` is a valid mode name: `{ concat: "opaque" }`, `{ concat: { ref: "a" } }`, and `{ concat: { concat: ["x", { ref: "a" }] } }` are mode maps. Only an exact singleton object with an array under `concat` is a concat expression. `{ concat: [] }` is therefore an invalid expression, never a mode map. `ref`, `value`, `visibility`, `description`, `deprecated`, and `extensions` remain reserved.

## Untrusted parsers

- `parseTokenGraph(input: unknown)`
- `parseTokenLayer(input: unknown)`
- `parseCompiledScheme(input: unknown)`

Parsers do not throw for JSON-compatible input. They strictly validate kinds, versions, properties, definition and reference shapes, and available mode coverage, then return an owned canonical artifact under `value`. Graph parsing also validates reference targets and cycles.

Parsed key sets are dynamic. `parseTokenGraph()` returns `TokenGraph` with `string` keys and public keys, and `parseTokenLayer()` returns `TokenLayer` with an unknown mode set and visibility. `parseCompiledScheme()` always returns an incomplete token record, and exporting CSS from it keeps `variableByToken` partial.

```ts
import { compileTokenGraph, parseTokenGraph } from "scheme-tokens";

declare const input: unknown;
const parsed = parseTokenGraph(input);

if (parsed.ok) {
  const compiled = compileTokenGraph(parsed.value, {
    selection: "public",
  });
}
```

## Compilation

`compileTokenGraph()` supports `selection: "public"`, `selection: "all"`, and exact `{ keys }` selection. It validates the complete graph before selection, so public tokens can safely reference internal tokens.

Compiled values remain `tokens[key][mode]`. Metadata contains effective `visibility` and non-empty `declarations` in composition order. Each declaration contains `origin: { kind: "graph" }` or `{ kind: "layer", id }`, plus `visibility` only when explicitly authored. The last declaration wins. Sparse `expressionByMode` omits literal modes, retains pure `{ ref }` records without duplicated values, and retains canonical concat parts with `{ ref, value }` for referenced parts. Descriptions, deprecation, and extensions come only from the winner.

Omitted and explicit `public` selection have complete token and metadata records keyed by the public keys when TypeScript knows them: a finite key set and literal visibility at every composition position. Otherwise they are partial over every graph key. `all` is complete for a finite key set; an exact literal key tuple is complete after runtime validation. Parsed graphs, dynamic key sets, and runtime key arrays remain partial. Advanced annotations can express this through `CompiledScheme<Key, Mode, Complete>`; inference is preferred.

## CSS export

`exportCssVars()` supports prefix, scope, mode selector, and formatting options. The structured `value` contains `css`, `blocks`, and `variableByToken`. Exact selector maps already contain complete selectors, so their option lane excludes a separate `scope`; scope remains available with generated data-attribute and class selectors.

The `variableName` callback is advanced and contained. Exceptions, unsafe names, and collisions return issues.

`variableByToken` mirrors the compiled record's partial or complete key contract, including the partial result from a parsed compiled artifact and the complete result of a finite, fully known public selection. Exact selector maps are typed to the compiled mode union, requiring every mode and rejecting unknown modes.

Compilation and serialization preserve arbitrary strings. CSS export rejects declaration-unsafe strings with `invalid-css-value`. Its selector validation is an intentionally bounded safe grammar rather than a complete browser CSS parser.

See [Application Theme Coordinates](../guide/application-theme-coordinates.md) for a complete exact-selection and structured-block composition example.

## TypeScript

The supported compiler is TypeScript `>= 7.0 < 8.0`. `defineTokenGraph` returns a `DefinedTokenGraph`: a `TokenGraph<Key, Mode, PublicKey>` whose own authored keys are definite in `graph.tokens`, while a key that only a layer declares is not. `defineTokenLayer` infers `TokenLayer<Key, Mode, Visibility>`, where a layer `Mode` is `never` without mode maps, a finite union for a literal layer, and `string` when unknown, and `Visibility` is a `LayerVisibility`. Literal input is validated strictly; failures name the offending property, keep reference suggestions, and use the diagnostic markers described in [TypeScript Access](../guide/typescript-access.md). Precise claims are nominal: only the helpers and the values that flow from them make one. A finite key union is an exact claim, and an object literal, a spread copy, or a plain `TokenGraph` or `TokenLayer` describes unknown data.

## Serializers and schemas

The three serializers emit canonical supported artifacts. Published schema subpaths are:

- `scheme-tokens/schemas/token-graph.v2.schema.json`
- `scheme-tokens/schemas/token-layer.v2.schema.json`
- `scheme-tokens/schemas/compiled-scheme.v2.schema.json`

Strict token definitions have one required `value`, which contains either a string/reference/concat expression or a complete mode map.

Current writers emit `formatVersion: 2`. Source parsers also accept historical v1 graphs/layers, upgrade once, and validate under the same current rules. Shadowed graph declarations move to a deterministic leading synthetic layer; only necessary visibility restatements are added, and historical default-first mode order is preserved. V1 schema hints are validated historically and dropped on upgrade. Standalone inconsistent layer maps return `layer-mode-mismatch`. Compiled v1 is rejected with `invalid-format-version`: recompile its source graph.

In v2, `$schema` may be any string. It is preserved verbatim, never fetched or used for version selection, and never synthesized. Trusted helpers do not accept `$schema`. Only `kind` and `formatVersion` select the runtime format. A documented editor hint for the planned 0.4 release is `https://cdn.jsdelivr.net/npm/scheme-tokens@0.4.0/schemas/token-graph.v2.schema.json`; that release is not published yet. Each packaged schema has a stable identity such as `tag:maikel.site,2026-09-29:scheme-tokens/schema/token-graph/v2`. All three are self-contained Draft 2020-12 with fragment-only internal references.
